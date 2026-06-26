import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  generateAnswer: (query: string, snippets: string) =>
    ipcRenderer.invoke('generate-answer', { query, snippets }),
  selectImage: () => ipcRenderer.invoke('select-image'),
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', { title, body }),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  onBackendReady: (callback: (url: string) => void) => {
    ipcRenderer.on('backend-ready', (_event, url: string) => callback(url))
  },
  onSplashProgress: (callback: (step: number) => void) => {
    ipcRenderer.on('splash-progress', (_event, step: number) => callback(step))
  },
})
