/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  openExternal: (url: string) => Promise<void>
  generateAnswer: (query: string, snippets: string) => Promise<{ answer: string | null; error?: string }>
  selectImage: () => Promise<{ canceled: boolean; data?: string; ext?: string; name?: string }>
  showNotification: (title: string, body: string) => Promise<void>
}

interface Window {
  electronAPI?: ElectronAPI
}
