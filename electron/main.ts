import fs from 'fs'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
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

function startBackend(): Promise<void> {
  return new Promise((resolve) => {
    const dataDir = app.getPath('userData')
    const env = { ...process.env, UNIPATH_DATA_DIR: dataDir }
    let started = false

    if (app.isPackaged && BACKEND_BINARY && fs.existsSync(BACKEND_BINARY)) {
      backendProcess = spawn(BACKEND_BINARY, [], {
        cwd: dataDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      })
    } else {
      const python = findVenvPython() || findPython()
      const args = ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000']
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
        resolve()
      }
    })

    backendProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      if (!started && text.includes('Uvicorn running on')) {
        started = true
        resolve()
      }
    })

    backendProcess.on('error', () => {
      if (!started) {
        started = true
        resolve()
      }
    })

    backendProcess.on('exit', () => {
      backendProcess = null
      if (!started) {
        started = true
        resolve()
      }
    })

    setTimeout(() => {
      if (!started) {
        started = true
        resolve()
      }
    }, 12000)
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

app.on('window-all-closed', () => {
  if (backendProcess) {
    if (IS_WIN) {
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'])
    } else {
      backendProcess.kill()
    }
    backendProcess = null
  }
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
})
