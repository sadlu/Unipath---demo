/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  openExternal: (url: string) => Promise<void>
  generateAnswer: (query: string, snippets: string) => Promise<{ answer: string | null; error?: string }>
  selectImage: () => Promise<{ canceled: boolean; data?: string; ext?: string; name?: string }>
  showNotification: (title: string, body: string) => Promise<void>
  getBackendUrl: () => Promise<string>
  getBackendStatus: () => Promise<{ running: boolean }>
  onBackendReady: (callback: (url: string) => void) => void
}

interface CapacitorPlatform {
  getPlatform: () => string
}

interface Window {
  electronAPI?: ElectronAPI
  Capacitor?: { getPlatform: () => string; isNativePlatform: () => boolean; plugin: (name: string) => any }
}
