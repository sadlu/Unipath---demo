import fs from 'fs'
import { app, BrowserWindow, ipcMain, shell, Notification, dialog } from 'electron'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { spawn, spawnSync, execSync, type ChildProcess } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
let splash: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

const PROJECT_ROOT = app.isPackaged ? path.join(process.resourcesPath, '..') : path.resolve(__dirname, '..')
const IS_WIN = os.platform() === 'win32'

function findBackendBinary(): string | null {
  if (!app.isPackaged) return null

  const candidates = IS_WIN
    ? [
        path.join(process.resourcesPath, 'backend-bin', 'unipath-backend.exe'),
        path.join(process.resourcesPath, 'backend-bin', 'unipath-backend'),
        path.join(PROJECT_ROOT, 'backend-bin', 'unipath-backend.exe'),
      ]
    : [
        path.join(process.resourcesPath, 'backend-bin', 'unipath-backend'),
        path.join(PROJECT_ROOT, 'backend-bin', 'unipath-backend'),
      ]

  for (const p of candidates) {
    try {
      fs.accessSync(p, fs.constants.X_OK)
      return p
    } catch {
      try {
        fs.accessSync(p, fs.constants.R_OK)
        return p
      } catch {}
    }
  }
  return null
}

const BACKEND_BINARY = findBackendBinary()

function findPython(): string {
  const candidates = IS_WIN ? ['python', 'python3', 'py'] : ['python3', 'python']
  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd, ['--version'], { stdio: 'pipe', timeout: 3000 })
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

function detectFreePort(preferred: number, maxAttempts = 50): number {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferred + i
    try {
      const result = spawnSync(
        IS_WIN ? 'powershell' : 'bash',
        IS_WIN
          ? [
              '-NoProfile', '-Command',
              `$l = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback, ${port}); try { $l.Start(); exit 0 } catch { exit 1 } finally { $l.Stop() }`,
            ]
          : [`echo >/dev/tcp/127.0.0.1/${port} 2>/dev/null && exit 1 || exit 0`],
        { timeout: 2000, stdio: 'pipe' }
      )
      if (result.status === 0) return port
    } catch {}
  }
  return preferred
}

function readPortFromFile(): number | null {
  if (!IS_WIN) return null
  try {
    const portFile = path.join(os.tmpdir(), 'unipath-port.txt')
    if (fs.existsSync(portFile)) {
      const port = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10)
      if (!isNaN(port) && port > 0 && port < 65536) return port
    }
  } catch {}
  return null
}

const BACKEND_PORT = readPortFromFile() || detectFreePort(parseInt(process.env.PORT || '8000', 10))
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

function showSplash() {
  splash = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    show: true,
    backgroundColor: '#13111C',
    webPreferences: { sandbox: true },
  })
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #13111C; color: #E2D9F3; font-family: -apple-system, system-ui, sans-serif;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        height: 100vh; gap: 24px;
      }
      .logo {
        font-size: 48px; font-weight: 800;
        background: linear-gradient(135deg, #7C3AED, #A78BFA);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .status { font-size: 14px; color: #9CA3AF; }
      .spinner {
        width: 32px; height: 32px; border: 3px solid #374151;
        border-top-color: #7C3AED; border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .steps { text-align: left; font-size: 13px; color: #6B7280; line-height: 2; }
      .steps .done { color: #34D399; }
      .steps .active { color: #A78BFA; font-weight: 600; }
    </style></head>
    <body>
      <div class="logo">UniPath</div>
      <div class="spinner"></div>
      <div class="status">Starting up...</div>
      <div class="steps" id="steps">
        <div id="s1">○ Starting backend server...</div>
        <div id="s2">○ Connecting to services...</div>
        <div id="s3">○ Loading your experience...</div>
      </div>
      <script>
        let s = 1;
        function mark(n) {
          for (let i = 1; i <= n && i <= 3; i++) {
            const el = document.getElementById('s' + i);
            el.className = 'done';
            el.innerHTML = '● ' + el.innerHTML.slice(2);
          }
          if (n < 3) {
            const next = document.getElementById('s' + (n + 1));
            next.innerHTML = '● ' + next.innerHTML.slice(2);
          }
        }
        window.electronAPI?.onSplashProgress((step) => { mark(step); });
      </script>
    </body>
    </html>
  `)}`)
}

function updateSplash(step: number) {
  splash?.webContents.executeJavaScript(`mark(${step})`).catch(() => {})
}

function closeSplash() {
  if (splash && !splash.isDestroyed()) {
    splash.close()
    splash = null
  }
}

function startBackend(): Promise<void> {
  return new Promise((resolve) => {
    const dataDir = app.getPath('userData')
    const env = { ...process.env, UNIPATH_DATA_DIR: dataDir, PORT: String(BACKEND_PORT) }
    let started = false
    let attempts = 0
    const maxAttempts = 3

    function tryStart() {
      if (attempts >= maxAttempts) {
        console.warn('[UniPath] Backend failed to start after max attempts')
        started = true
        resolve()
        return
      }
      attempts++
      updateSplash(1)

      if (BACKEND_BINARY && fs.existsSync(BACKEND_BINARY)) {
        console.log(`[UniPath] Starting backend binary: ${BACKEND_BINARY} on port ${BACKEND_PORT}`)
        backendProcess = spawn(BACKEND_BINARY, ['--port', String(BACKEND_PORT)], {
          cwd: dataDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
        })
      } else {
        const python = findVenvPython() || findPython()
        console.log(`[UniPath] Starting backend via ${python} on port ${BACKEND_PORT}`)
        const args = ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)]
        backendProcess = spawn(python, args, {
          cwd: PROJECT_ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
        })
      }

      backendProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (!started && (text.includes('Uvicorn running on') || text.includes('Application startup complete'))) {
          started = true
          console.log('[UniPath] Backend started successfully')
          updateSplash(2)
          resolve()
        }
      })

      backendProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (!started && (text.includes('Uvicorn running on') || text.includes('Application startup complete'))) {
          started = true
          console.log('[UniPath] Backend started successfully')
          updateSplash(2)
          resolve()
        }
        if (text.includes('Address already in use') || text.includes('OSError: [Errno 48]')) {
          console.warn(`[UniPath] Port ${BACKEND_PORT} already in use, trying next port`)
          if (backendProcess) {
            try { backendProcess.kill() } catch {}
            backendProcess = null
          }
          const newPort = detectFreePort(BACKEND_PORT + 1)
          env.PORT = String(newPort)
          ;(globalThis as any).__UNIPATH_PORT = newPort
          started = true
          resolve()
        }
      })

      backendProcess.on('error', (err) => {
        console.warn(`[UniPath] Backend attempt ${attempts} failed: ${err.message}`)
        backendProcess = null
        if (!started) setTimeout(tryStart, 2000)
      })

      backendProcess.on('exit', (code) => {
        backendProcess = null
        if (!started) {
          console.warn(`[UniPath] Backend exited with code ${code}, retrying...`)
          setTimeout(tryStart, 2000)
        }
      })
    }

    tryStart()

    setTimeout(() => {
      if (!started) {
        started = true
        console.warn('[UniPath] Backend start timed out (25s) - launching app anyway')
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
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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

  win.once('ready-to-show', () => {
    closeSplash()
    win?.show()
  })
}

ipcMain.handle('get-backend-url', () => BACKEND_URL)

ipcMain.handle('get-backend-port', () => BACKEND_PORT)

ipcMain.handle('get-backend-status', async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(3000) })
    return { running: res.ok, port: BACKEND_PORT }
  } catch {
    return { running: false, port: BACKEND_PORT }
  }
})

ipcMain.handle('select-image', async () => {
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
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
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
    if (!modelPipe) await loadModel()
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
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], { stdio: 'ignore' })
      spawn('taskkill', ['/IM', 'unipath-backend.exe', '/f'], { stdio: 'ignore' })
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
  showSplash()
  console.log(`[UniPath] Starting on port ${BACKEND_PORT}`)
  await startBackend()
  updateSplash(3)
  createWindow()

  if (win) {
    win.webContents.on('did-finish-load', async () => {
      const startTime = Date.now()
      while (Date.now() - startTime < 15000) {
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

  loadModel().catch((err) => console.error('[UniPath] Failed to load AI model:', err))
})
