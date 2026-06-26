const ELECTRON_API_KEY = 'electronAPI'

function getWindow(): any {
  return typeof window !== 'undefined' ? window : {}
}

export function isElectron(): boolean {
  return !!(getWindow()[ELECTRON_API_KEY])
}

export function isCapacitor(): boolean {
  return !!(getWindow().Capacitor)
}

export function isAndroid(): boolean {
  if (!isCapacitor()) return false
  try {
    return getWindow().Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}

export function isIOS(): boolean {
  if (!isCapacitor()) return false
  try {
    return getWindow().Capacitor.getPlatform() === 'ios'
  } catch {
    return false
  }
}

export function isMobileApp(): boolean {
  return isAndroid() || isIOS()
}

export function isWeb(): boolean {
  return !isElectron() && !isCapacitor()
}
