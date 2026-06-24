import { create } from 'zustand'
import type { UserData, UserSettings, AppPreferences, ThemeMode } from '../types'
import * as localAuth from '../localAuth'

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
      if (data && typeof data.xp === 'number') {
        if (data.settings && typeof data.settings.general1 === 'boolean') {
          data.settings.autoSave = data.settings.general2 ?? true
          data.settings.desktopNotifications = data.settings.general3 ?? true
          data.settings.pushNotifications = data.settings.pushNotifications ?? true
          data.settings.emailAlerts = data.settings.emailAlerts ?? false
          data.settings.inAppSounds = data.settings.inAppSounds ?? true
          data.settings.soundVolume = data.settings.soundVolume ?? 50
          data.settings.shareAnalytics = data.settings.shareAnalytics ?? true
          data.settings.onlineStatus = data.settings.onlineStatus ?? true
          data.settings.reduceMotion = data.settings.reduceMotion ?? false
        }
        return data
      }
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

  authMethod: 'guest' | 'local' | null
  userData: UserData
  currentCardIndex: number

  confettiActive: boolean
  achievementModal: string | null

  loginLocal: (username: string, password: string) => Promise<void>
  registerLocal: (username: string, password: string, displayName: string, subjects?: string[]) => Promise<void>
  continueAsGuest: () => void
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

function persistData(state: { authMethod: 'guest' | 'local' | null; userData: UserData }) {
  if (state.authMethod === 'guest') {
    saveGuestData(state.userData)
  } else if (state.authMethod === 'local') {
    localAuth.saveCurrentUserData(state.userData).catch((err) =>
      console.error('[Store] Failed to save encrypted data:', err)
    )
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

    loginLocal: async (username, password) => {
      const userData = await localAuth.login(username, password)
      const { getProfile } = await import('../services/api')
      getProfile(username).then((profile) => {
        if (profile?.avatar_url) {
          set((s) => ({
            userData: { ...s.userData, photoURL: profile.avatar_url! },
          }))
        }
      }).catch(() => {})
      set({ authMethod: 'local', userData })
    },

    registerLocal: async (username, password, displayName, subjects) => {
      await localAuth.createAccount(username, password, displayName, subjects)
      const api = await import('../services/api')
      await api.initPeopleUser(username, displayName, username).catch(() => {})
      const userData = await localAuth.login(username, password)
      api.getProfile(username).then((profile) => {
        if (profile?.avatar_url) {
          set((s) => ({
            userData: { ...s.userData, photoURL: profile.avatar_url! },
          }))
        }
      }).catch(() => {})
      set({ authMethod: 'local', userData: { ...userData, hasSeenTutorial: false } })
    },

    continueAsGuest: () => {
      const existing = loadGuestData()
      const userData = existing || { ...GUEST_USER }
      if (!existing) saveGuestData(userData)
      set({ authMethod: 'guest', userData })
    },

    logout: () => {
      localAuth.clearSession()
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
      persistData({ authMethod, userData: updated })

      const hasFirstDiscovery = userData.achievements.includes('First Discovery')
      if (newXP >= 200 && !hasFirstDiscovery) {
        const withAchievement = {
          ...updated,
          achievements: [...updated.achievements, 'First Discovery'],
        }
        set({ userData: withAchievement, confettiActive: true, achievementModal: 'First Discovery' })
        persistData({ authMethod, userData: withAchievement })
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
      persistData({ authMethod, userData: updated })
    },

    setSetting: (key, value) => {
      const { authMethod, userData } = get()
      const newSettings = { ...userData.settings, [key]: value }
      const updated = { ...userData, settings: newSettings }
      set({ userData: updated })
      persistData({ authMethod, userData: updated })
    },

    setEmail: (email) => {
      const { authMethod, userData } = get()
      const updated = { ...userData, email }
      set({ userData: updated })
      persistData({ authMethod, userData: updated })
    },

    setSliderValue: (value) => {
      const { authMethod, userData } = get()
      const updated = { ...userData, sliderValue: value }
      set({ userData: updated })
      persistData({ authMethod, userData: updated })
    },

    advanceCard: (totalCards) => {
      const { currentCardIndex } = get()
      const next = (currentCardIndex + 1) % totalCards
      set({ currentCardIndex: next })
    },

    setHasSeenTutorial: () => {
      const { authMethod, userData } = get()
      const updated = { ...userData, hasSeenTutorial: true }
      set({ userData: updated })
      persistData({ authMethod, userData: updated })
    },

    dismissConfetti: () => set({ confettiActive: false }),
    dismissAchievement: () => set({ achievementModal: null }),

    resetAllProgress: () => {
      const { authMethod } = get()
      clearGuestData()
      if (authMethod === 'local') {
        const username = localAuth.getSessionUsername()
        if (username) localStorage.removeItem('unipath_user_' + username)
      }
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
