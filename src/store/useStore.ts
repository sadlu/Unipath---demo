import { create } from 'zustand'
import type { UserData, UserSettings, AppPreferences, ThemeMode } from '../types'
import * as api from '../services/api'

const GUEST_STORAGE_KEY = 'unipath_guest_data'
const PREFS_STORAGE_KEY = 'unipath_preferences'

const DEFAULT_SETTINGS: UserSettings = {
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
}

const GUEST_USER: UserData = {
  displayName: 'Guest User',
  email: 'guest@unipath.local',
  photoURL: '',
  uid: 'guest',
  level: 1,
  xp: 0,
  streakDays: 0,
  sliderValue: 50,
  settings: { ...DEFAULT_SETTINGS },
  achievements: [],
  subjects: [],
  hasSeenTutorial: true,
}

function calcLevel(xp: number): number {
  if (xp >= 1000) return 5
  if (xp >= 600) return 4
  if (xp >= 300) return 3
  if (xp >= 100) return 2
  return 1
}

function loadGuestData(): UserData | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && typeof data.xp === 'number') return data
    }
  } catch {}
  return null
}

function saveGuestData(data: UserData) {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data))
}

function clearGuestData() {
  localStorage.removeItem(GUEST_STORAGE_KEY)
}

function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && typeof data.theme === 'string') return data
    }
  } catch {}
  return { theme: 'dark', accentColor: '#7C5CFC', language: 'en' }
}

function savePreferences(prefs: AppPreferences) {
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
}

interface AppState {
  view: string
  setView: (view: string) => void

  preferences: AppPreferences
  setTheme: (theme: ThemeMode) => void
  setAccentColor: (color: string) => void
  setLanguage: (lang: string) => void

  authMethod: 'guest' | 'server' | null
  userData: UserData
  currentCardIndex: number

  confettiActive: boolean
  achievementModal: string | null

  loginServer: (username: string, password: string) => Promise<void>
  registerServer: (username: string, password: string, displayName: string, subjects?: string[]) => Promise<void>
  continueAsGuest: () => void
  restoreSession: () => Promise<void>
  logout: () => void

  addXP: (amount: number) => void
  toggleSetting: (key: keyof UserSettings) => void
  setSetting: (key: keyof UserSettings, value: boolean | number) => void
  setEmail: (email: string) => void
  setSliderValue: (value: number) => void
  advanceCard: (totalCards: number) => void
  setHasSeenTutorial: () => void
  dismissConfetti: () => void
  dismissAchievement: () => void
  resetAllProgress: () => void
}

function syncToServer(userData: UserData) {
  const token = api.getStoredToken()
  if (!token) return
  api.authSync(token, {
    xp: userData.xp,
    level: userData.level,
    streak_days: userData.streakDays,
    subjects: userData.subjects,
    slider_value: userData.sliderValue,
    achievements: userData.achievements,
    settings: userData.settings as Record<string, any>,
  }).catch(() => {})
}

function apiUserToUserData(u: api.AuthUserData): UserData {
  return {
    displayName: u.displayName,
    email: u.email,
    photoURL: u.photoURL,
    uid: u.uid,
    level: u.level,
    xp: u.xp,
    streakDays: u.streakDays,
    sliderValue: u.sliderValue,
    settings: { ...DEFAULT_SETTINGS, ...u.settings } as UserSettings,
    achievements: u.achievements,
    subjects: u.subjects,
    hasSeenTutorial: u.hasSeenTutorial,
  }
}

export const useStore = create<AppState>((set, get) => {
  const guestData = loadGuestData()
  const initialPrefs = loadPreferences()

  return {
    view: 'home',
    setView: (view) => set({ view }),

    preferences: initialPrefs,
    setTheme: (theme) => {
      const current = get().preferences
      const updated = { ...current, theme }
      savePreferences(updated)
      set({ preferences: updated })
      applyTheme(theme)
    },
    setAccentColor: (accentColor) => {
      const current = get().preferences
      const updated = { ...current, accentColor }
      savePreferences(updated)
      set({ preferences: updated })
      document.documentElement.style.setProperty('--accent', accentColor)
    },
    setLanguage: (language) => {
      const current = get().preferences
      const updated = { ...current, language }
      savePreferences(updated)
      set({ preferences: updated })
    },

    authMethod: guestData ? 'guest' : null,
    userData: guestData || { ...GUEST_USER },
    currentCardIndex: 0,

    confettiActive: false,
    achievementModal: null,

    loginServer: async (username, password) => {
      const result = await api.authLogin(username, password)
      if (!result.ok || !result.token || !result.user) {
        throw new Error(result.error || 'Login failed')
      }
      api.storeToken(result.token)
      if (result.refresh_token) api.storeRefreshToken(result.refresh_token)
      const userData = apiUserToUserData(result.user)
      set({ authMethod: 'server', userData })
    },

    registerServer: async (username, password, displayName, subjects) => {
      const result = await api.authRegister(username, displayName, password, subjects)
      if (!result.ok || !result.token || !result.user) {
        throw new Error(result.error || 'Registration failed')
      }
      api.storeToken(result.token)
      if (result.refresh_token) api.storeRefreshToken(result.refresh_token)
      let userData = apiUserToUserData(result.user)
      userData = { ...userData, hasSeenTutorial: false }
      set({ authMethod: 'server', userData })
    },

    restoreSession: async () => {
      let token = api.getStoredToken()
      if (!token) return
      let result = await api.authMe(token)
      if (!result.ok || !result.user) {
        const refreshToken = api.getStoredRefreshToken()
        if (refreshToken) {
          const refreshResult = await api.authRefresh(refreshToken)
          if (refreshResult.ok && refreshResult.token) {
            api.storeToken(refreshResult.token)
            if (refreshResult.refresh_token) api.storeRefreshToken(refreshResult.refresh_token)
            token = refreshResult.token
            result = await api.authMe(token)
          }
        }
        if (!result.ok || !result.user) {
          api.clearToken()
          api.clearRefreshToken()
          return
        }
      }
      const userData = apiUserToUserData(result.user)
      set({ authMethod: 'server', userData })
    },

    continueAsGuest: () => {
      const existing = loadGuestData()
      const userData = existing || { ...GUEST_USER }
      if (!existing) saveGuestData(userData)
      set({ authMethod: 'guest', userData })
    },

    logout: async () => {
      const token = api.getStoredToken()
      if (token) {
        await api.authLogout(token)
      }
      clearGuestData()
      sessionStorage.clear()
      set({
        authMethod: null,
        userData: { ...GUEST_USER },
        currentCardIndex: 0,
        confettiActive: false,
        achievementModal: null,
      })
    },

    addXP: (amount) => {
      const { authMethod, userData } = get()
      const newXP = userData.xp + amount
      const newLevel = calcLevel(newXP)
      const updated = { ...userData, xp: newXP, level: newLevel }
      set({ userData: updated })
      if (authMethod === 'server') syncToServer(updated)
      else if (authMethod === 'guest') saveGuestData(updated)

      const hasFirstDiscovery = userData.achievements.includes('First Discovery')
      if (newXP >= 200 && !hasFirstDiscovery) {
        const withAchievement = {
          ...updated,
          achievements: [...updated.achievements, 'First Discovery'],
        }
        set({ userData: withAchievement, confettiActive: true, achievementModal: 'First Discovery' })
        if (authMethod === 'server') syncToServer(withAchievement)
        else if (authMethod === 'guest') saveGuestData(withAchievement)
      }
    },

    toggleSetting: (key) => {
      const { authMethod, userData } = get()
      const currentVal = userData.settings[key]
      if (typeof currentVal !== 'boolean') return
      const newSettings = { ...userData.settings, [key]: !currentVal }
      if (key === 'notifications' && !newSettings.notifications) {
        newSettings.pushNotifications = false
        newSettings.emailAlerts = false
        newSettings.inAppSounds = false
      }
      const updated = { ...userData, settings: newSettings }
      set({ userData: updated })
      if (authMethod === 'server') syncToServer(updated)
      else if (authMethod === 'guest') saveGuestData(updated)
    },

    setSetting: (key, value) => {
      const { authMethod, userData } = get()
      const newSettings = { ...userData.settings, [key]: value }
      const updated = { ...userData, settings: newSettings }
      set({ userData: updated })
      if (authMethod === 'server') syncToServer(updated)
      else if (authMethod === 'guest') saveGuestData(updated)
    },

    setEmail: (email) => {
      const { authMethod, userData } = get()
      const updated = { ...userData, email }
      set({ userData: updated })
      if (authMethod === 'server') syncToServer(updated)
      else if (authMethod === 'guest') saveGuestData(updated)
    },

    setSliderValue: (value) => {
      const { authMethod, userData } = get()
      const updated = { ...userData, sliderValue: value }
      set({ userData: updated })
      if (authMethod === 'server') syncToServer(updated)
      else if (authMethod === 'guest') saveGuestData(updated)
    },

    advanceCard: (totalCards) => {
      if (totalCards <= 0) return
      const { currentCardIndex } = get()
      const next = (currentCardIndex + 1) % totalCards
      set({ currentCardIndex: next })
    },

    setHasSeenTutorial: () => {
      const { authMethod, userData } = get()
      const updated = { ...userData, hasSeenTutorial: true }
      set({ userData: updated })
      if (authMethod === 'server') syncToServer(updated)
      else if (authMethod === 'guest') saveGuestData(updated)
    },

    dismissConfetti: () => set({ confettiActive: false }),
    dismissAchievement: () => set({ achievementModal: null }),

    resetAllProgress: () => {
      clearGuestData()
      api.clearToken()
      set({
        authMethod: null,
        userData: { ...GUEST_USER },
        currentCardIndex: 0,
      })
    },
  }
})

function applyTheme(theme: ThemeMode) {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  if (isDark) {
    document.documentElement.style.setProperty('--bg-primary', '#13111C')
    document.documentElement.style.setProperty('--bg-secondary', '#1C192C')
  } else {
    document.documentElement.style.setProperty('--bg-primary', '#FFFFFF')
    document.documentElement.style.setProperty('--bg-secondary', '#F5F5F7')
  }
}
