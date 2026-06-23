import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

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
    const allowedAuthPopup =
      url.startsWith('https://') &&
      (url.includes('.supabase.co') || url.includes('accounts.google.com') || url.includes('googleusercontent.com') || url.includes('googleapis.com'))

    if (allowedAuthPopup) {
      return { action: 'allow' }
    }

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

ipcMain.handle('oauth:sign-in', async (_, oauthUrl: string) => {
  return new Promise<void>((resolve, reject) => {
    const popup = new BrowserWindow({
      width: 600,
      height: 700,
      parent: win!,
      modal: true,
      show: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    let loadFailed = false
    let loadError = ''

    const popupTimeout = setTimeout(() => {
      if (!popup.isDestroyed()) {
        popup.close()
      }
      reject(new Error('Sign-in timed out. Please try again.'))
    }, 120000)

    popup.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      loadFailed = true
      loadError = `Failed to load auth page (${errorCode}: ${errorDescription})`
      console.error('[oauth] did-fail-load:', loadError)
    })

    popup.webContents.on('did-finish-load', () => {
      loadFailed = false
      loadError = ''
    })

    popup.loadURL(oauthUrl).catch((err) => {
      loadFailed = true
      loadError = `Failed to load auth page: ${err.message}`
      console.error('[oauth] loadURL error:', loadError)
    })

    const checkUrl = (_event: Electron.Event, url: string) => {
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file://')) {
        setTimeout(() => {
          if (!popup.isDestroyed()) {
            popup.close()
          }
        }, 2500)
      }
    }

    popup.webContents.on('will-redirect', checkUrl)
    popup.webContents.on('did-navigate', checkUrl)

    popup.on('closed', () => {
      clearTimeout(popupTimeout)
      if (loadFailed) {
        reject(new Error(loadError || 'Auth popup failed to load'))
      } else {
        resolve()
      }
    })
  })
})

app.on('window-all-closed', () => {
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

app.whenReady().then(createWindow)
