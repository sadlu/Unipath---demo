import type { UserData } from './types'

const STORAGE_PREFIX = 'unipath_user_'

interface LocalAccount {
  username: string
  displayName: string
  salt: string
  iv: string
  encryptedData: string
}

let _sessionUsername: string | null = null
let _sessionPassword: string | null = null

function bytesToStr(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}
function strToBytes(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function getSessionUsername(): string | null {
  return _sessionUsername
}

export function clearSession(): void {
  _sessionUsername = null
  _sessionPassword = null
}

export function accountExists(username: string): boolean {
  return localStorage.getItem(STORAGE_PREFIX + username) !== null
}

export async function createAccount(
  username: string,
  password: string,
  displayName: string,
  subjects: string[] = []
): Promise<void> {
  if (accountExists(username)) throw new Error('Account already exists')

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(password, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify({
        displayName,
        email: username,
        subjects,
        xp: 0,
        level: 1,
        streakDays: 0,
        sliderValue: 50,
        settings: {
          notifications: true,
          pushNotifications: true,
          emailAlerts: false,
          inAppSounds: true,
          soundVolume: 50,
          shareAnalytics: true,
          onlineStatus: true,
          autoSave: true,
          desktopNotifications: true,
          reduceMotion: false,
        },
        achievements: [],
      }))
    )
  )

  const account: LocalAccount = {
    username,
    displayName,
    salt: bytesToStr(salt),
    iv: bytesToStr(iv),
    encryptedData: bytesToStr(ciphertext),
  }

  localStorage.setItem(STORAGE_PREFIX + username, JSON.stringify(account))
  _sessionUsername = username
  _sessionPassword = password
}

export async function login(username: string, password: string): Promise<UserData> {
  const raw = localStorage.getItem(STORAGE_PREFIX + username)
  if (!raw) throw new Error('Account not found')

  const account: LocalAccount = JSON.parse(raw)
  const salt = strToBytes(account.salt)
  const iv = strToBytes(account.iv)
  const ciphertext = strToBytes(account.encryptedData)
  const key = await deriveKey(password, salt)

  let data: any
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
    data = JSON.parse(new TextDecoder().decode(decrypted))
  } catch {
    throw new Error('Invalid password or corrupted data')
  }

  _sessionUsername = username
  _sessionPassword = password

  return {
    displayName: account.displayName,
    email: data.email || username,
    photoURL: '',
    uid: username,
    xp: data.xp || 0,
    level: data.level || 1,
    streakDays: data.streakDays || 0,
    sliderValue: data.sliderValue ?? 50,
    subjects: data.subjects || [],
    settings: (() => {
      const s = data.settings || {}
      if (typeof s.general1 === 'boolean') {
        s.autoSave = s.general2 ?? true
        s.desktopNotifications = s.general3 ?? true
        s.pushNotifications = s.pushNotifications ?? true
        s.emailAlerts = s.emailAlerts ?? false
        s.inAppSounds = s.inAppSounds ?? true
        s.soundVolume = s.soundVolume ?? 50
        s.shareAnalytics = s.shareAnalytics ?? true
        s.onlineStatus = s.onlineStatus ?? true
        s.reduceMotion = s.reduceMotion ?? false
      }
      return {
        notifications: s.notifications ?? true,
        pushNotifications: s.pushNotifications ?? true,
        emailAlerts: s.emailAlerts ?? false,
        inAppSounds: s.inAppSounds ?? true,
        soundVolume: s.soundVolume ?? 50,
        shareAnalytics: s.shareAnalytics ?? true,
        onlineStatus: s.onlineStatus ?? true,
        autoSave: s.autoSave ?? true,
        desktopNotifications: s.desktopNotifications ?? true,
        reduceMotion: s.reduceMotion ?? false,
      }
    })(),
    achievements: data.achievements || [],
  }
}

export async function saveCurrentUserData(userData: UserData): Promise<void> {
  if (!_sessionUsername || !_sessionPassword) throw new Error('No active session')

  const raw = localStorage.getItem(STORAGE_PREFIX + _sessionUsername)
  if (!raw) throw new Error('Account not found')

  const account: LocalAccount = JSON.parse(raw)
  const salt = strToBytes(account.salt)
  const key = await deriveKey(_sessionPassword, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify({
        displayName: userData.displayName,
        email: userData.email,
        subjects: userData.subjects,
        xp: userData.xp,
        level: userData.level,
        streakDays: userData.streakDays,
        sliderValue: userData.sliderValue,
        settings: userData.settings,
        achievements: userData.achievements,
      }))
    )
  )

  account.iv = bytesToStr(iv)
  account.encryptedData = bytesToStr(ciphertext)
  account.displayName = userData.displayName

  localStorage.setItem(STORAGE_PREFIX + _sessionUsername, JSON.stringify(account))
}
