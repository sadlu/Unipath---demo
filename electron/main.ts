import fs from 'fs'
import { app, BrowserWindow, ipcMain, shell, Notification } from 'electron'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { spawn, spawnSync, type ChildProcess } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

const PROJECT_ROOT = app.isPackaged ? path.join(process.resourcesPath, '..') : path.resolve(__dirname, '..')
const BACKEND_DIR = app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.join(PROJECT_ROOT, 'backend')
const IS_WIN = os.platform() === 'win32'

const BACKEND_BINARY = app.isPackaged
  ? path.join(process.resourcesPath, 'backend-bin', IS_WIN ? 'unipath-backend.exe' : 'unipath-backend')
  : null



function findPython(): string {
  const candidates = IS_WIN ? ['python', 'python3'] : ['python3', 'python']
  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd, ['--version'], { stdio: 'pipe' })
      if (result.status === 0) return cmd
    } catch {}
  }
  return IS_WIN ? 'python' : 'python3'
}

function findVenvPython(): string | null {
  const venvPaths = IS_WIN
    ? [
        path.join(PROJECT_ROOT, 'backend', '.venv', 'Scripts', 'python.exe'),
        path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe'),
      ]
    : [
        path.join(PROJECT_ROOT, 'backend', '.venv', 'bin', 'python3'),
        path.join(PROJECT_ROOT, 'backend', '.venv', 'bin', 'python'),
        path.join(PROJECT_ROOT, '.venv', 'bin', 'python3'),
        path.join(PROJECT_ROOT, '.venv', 'bin', 'python'),
      ]
  for (const p of venvPaths) {
    try {
      fs.accessSync(p)
      return p
    } catch {}
  }
  return null
}

const BACKEND_PORT = 8000
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

function startBackend(): Promise<void> {
  return new Promise((resolve) => {
    const dataDir = app.getPath('userData')
    const env = { ...process.env, UNIPATH_DATA_DIR: dataDir }
    let started = false
    let attempts = 0
    const maxAttempts = 3

    function tryStart() {
      if (attempts >= maxAttempts) {
        console.warn('Backend failed to start after max attempts')
        started = true
        resolve()
        return
      }
      attempts++

      if (app.isPackaged && BACKEND_BINARY && fs.existsSync(BACKEND_BINARY)) {
        backendProcess = spawn(BACKEND_BINARY, [], {
          cwd: dataDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
        })
      } else {
        const python = findVenvPython() || findPython()
        const args = ['-m', 'uvicorn', 'backend.main:app', '--host', '0.0.0.0', '--port', String(BACKEND_PORT)]
        backendProcess = spawn(python, args, {
          cwd: PROJECT_ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
        })
      }

      backendProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (!started && text.includes('Uvicorn running on')) {
          started = true
          console.log('Backend started successfully')
          resolve()
        }
      })

      backendProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (!started && text.includes('Uvicorn running on')) {
          started = true
          console.log('Backend started successfully')
          resolve()
        }
      })

      backendProcess.on('error', () => {
        if (!started) {
          console.warn(`Backend attempt ${attempts} failed, retrying...`)
          backendProcess = null
          setTimeout(tryStart, 2000)
        }
      })

      backendProcess.on('exit', (code) => {
        backendProcess = null
        if (!started) {
          console.warn(`Backend exited with code ${code}, retrying...`)
          setTimeout(tryStart, 2000)
        }
      })
    }

    tryStart()

    setTimeout(() => {
      if (!started) {
        started = true
        resolve()
      }
    }, 25000)
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nativeWindowOpen: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

ipcMain.handle('get-backend-url', () => BACKEND_URL)

ipcMain.handle('get-backend-status', async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(3000) })
    return { running: res.ok }
  } catch {
    return { running: false }
  }
})

ipcMain.handle('select-image', async () => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return { canceled: true }
  const filePath = result.filePaths[0]
  const data = fs.readFileSync(filePath)
  const ext = path.extname(filePath).slice(1)
  return { canceled: false, data: data.toString('base64'), ext, name: path.basename(filePath) }
})

ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})
ipcMain.on('window:close', () => win?.close())
ipcMain.handle('open-external', async (_, url: string) => {
  if (typeof url === 'string' && url.startsWith('https://')) {
    await shell.openExternal(url)
  }
})

ipcMain.handle('show-notification', (_, { title, body }: { title: string; body: string }) => {
  if (!win || win.isFocused()) return
  new Notification({ title, body }).show()
})

let modelPipe: any = null

async function loadModel() {
  const { pipeline } = await import('@xenova/transformers')
  modelPipe = await pipeline('text2text-generation', 'Xenova/LaMini-T5-61M', {
    quantized: true,
  })
}

const NEPAL_SYSTEM_PROMPT = `You are a helpful assistant for the "Uni Path" app. Answer based ONLY on the search results provided. Never make up URLs. Focus on Nepal.`

function buildPrompt(query: string, snippets: string): string {
  return `${NEPAL_SYSTEM_PROMPT}\n\nUser query: ${query}\n\nSearch results:\n${snippets || "(No results)"}\n\nAnswer:`
}

ipcMain.handle('generate-answer', async (_event, { query, snippets }: { query: string; snippets: string }) => {
  try {
    if (!modelPipe) {
      await loadModel()
    }
    const prompt = buildPrompt(query, snippets)
    const result = await modelPipe(prompt, {
      max_new_tokens: 500,
      temperature: 0.3,
      do_sample: true,
    })
    return { answer: (result as any[])?.[0]?.generated_text?.trim() || null }
  } catch (err: any) {
    return { answer: null, error: err.message }
  }
})

function killBackend() {
  if (!backendProcess) return
  try {
    if (IS_WIN) {
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'])
    } else {
      backendProcess.kill('SIGTERM')
      setTimeout(() => {
        try { backendProcess?.kill('SIGKILL') } catch {}
      }, 3000)
    }
  } catch {}
  backendProcess = null
}

app.on('before-quit', () => killBackend())

app.on('window-all-closed', () => {
  killBackend()
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  await startBackend()
  createWindow()
  // Notify renderer when backend is ready
  if (win) {
    win.webContents.on('did-finish-load', async () => {
      const start = Date.now()
      while (Date.now() - start < 15000) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
          if (res.ok) {
            win?.webContents.send('backend-ready', BACKEND_URL)
            break
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1000))
      }
    })
  }
  loadModel().catch((err) => console.error('Failed to load AI model:', err))
})
