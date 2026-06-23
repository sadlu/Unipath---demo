/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  openExternal: (url: string) => Promise<void>
  oauthSignIn: (url: string) => Promise<void>
}

interface Window {
  electronAPI?: ElectronAPI
}
