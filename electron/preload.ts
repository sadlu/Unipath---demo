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
})
