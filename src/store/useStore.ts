import { create } from 'zustand'
import type { UserData } from '../types'
import { supabase, saveProfile, getProfile, getProfileFollowing, clearProfileData } from '../supabaseClient'

const STORAGE_KEY = 'unipath_store'

function calcLevel(xp: number): number {
  if (xp >= 1000) return 5
  if (xp >= 600) return 4
  if (xp >= 300) return 3
  if (xp >= 100) return 2
  return 1
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
  settings: {
    notifications: true,
    privacy: false,
    general1: true,
    general2: true,
    general3: true,
  },
  achievements: [],
  following: [],
}

interface GoogleUser {
  displayName: string
  email: string
  photoURL: string
  uid: string
}

interface PersistedState {
  authMode: 'guest' | 'google'
  googleUser: GoogleUser | null
  userData: UserData
  currentCardIndex: number
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as PersistedState
      if (data && data.userData && typeof data.userData.xp === 'number') {
        return data
      }
    }
  } catch {}
  return { authMode: 'guest', googleUser: null, userData: { ...GUEST_USER }, currentCardIndex: 0 }
}

function saveState(state: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function computeDisplayUser(
  authMode: 'guest' | 'google',
  googleUser: GoogleUser | null,
  userData: UserData
): UserData {
  if (authMode === 'google' && googleUser) {
    return {
      ...userData,
      displayName: googleUser.displayName,
      email: googleUser.email,
      photoURL: googleUser.photoURL,
      uid: googleUser.uid,
    }
  }
  return userData
}

interface AppState {
  view: string
  setView: (view: string) => void

  authMode: 'guest' | 'google'
  googleUser: GoogleUser | null
  userData: UserData
  currentCardIndex: number

  confettiActive: boolean
  achievementModal: string | null

  addXP: (amount: number) => void
  toggleSetting: (key: keyof UserData['settings']) => void
  setEmail: (email: string) => void
  setSliderValue: (value: number) => void
  setGoogleUser: (user: GoogleUser) => Promise<void>
  switchToGuest: () => void
  advanceCard: (totalCards: number) => void
  setFollowing: (uids: string[]) => void
  dismissConfetti: () => void
  dismissAchievement: () => void
  resetAllProgress: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => {
  const persisted = loadState()

  return {
    view: 'home',
    setView: (view) => set({ view }),

    authMode: persisted.authMode,
    googleUser: persisted.googleUser,
    userData: computeDisplayUser(persisted.authMode, persisted.googleUser, persisted.userData),
    currentCardIndex: persisted.currentCardIndex,

    confettiActive: false,
    achievementModal: null,

    addXP: (amount) => {
      const { authMode, googleUser, userData } = get()
      const internal = loadState()
      const baseUser = authMode === 'google' && googleUser ? internal.userData : userData
      const newXP = baseUser.xp + amount
      const newLevel = calcLevel(newXP)
      const updated = { ...baseUser, xp: newXP, level: newLevel }
      const display = computeDisplayUser(authMode, googleUser, updated)

      saveState({ ...internal, userData: updated })
      set({ userData: display })

      const hasFirstDiscovery = updated.achievements.includes('First Discovery')
      if (newXP >= 200 && !hasFirstDiscovery) {
        const withAchievement = {
          ...updated,
          achievements: [...updated.achievements, 'First Discovery'],
        }
        const displayWith = computeDisplayUser(authMode, googleUser, withAchievement)
        saveState({ ...internal, userData: withAchievement })
        set({ userData: displayWith, confettiActive: true, achievementModal: 'First Discovery' })
      }
    },

    toggleSetting: (key) => {
      const { authMode, googleUser, userData } = get()
      const internal = loadState()
      const baseUser = authMode === 'google' && googleUser ? internal.userData : userData
      const newSettings = {
        ...baseUser.settings,
        [key]: !baseUser.settings[key],
      }
      const updated = { ...baseUser, settings: newSettings }
      const display = computeDisplayUser(authMode, googleUser, updated)
      saveState({ ...internal, userData: updated })
      set({ userData: display })
    },

    setEmail: (email) => {
      const { authMode, googleUser, userData } = get()
      const internal = loadState()
      const baseUser = authMode === 'google' && googleUser ? internal.userData : userData
      const updated = { ...baseUser, email }
      const display = computeDisplayUser(authMode, googleUser, updated)
      saveState({ ...internal, userData: updated })
      set({ userData: display })
    },

    setSliderValue: (value) => {
      const { authMode, googleUser, userData } = get()
      const internal = loadState()
      const baseUser = authMode === 'google' && googleUser ? internal.userData : userData
      const updated = { ...baseUser, sliderValue: value }
      const display = computeDisplayUser(authMode, googleUser, updated)
      saveState({ ...internal, userData: updated })
      set({ userData: display })
    },

    setGoogleUser: async (googleUser) => {
      const internal = loadState()

      const existing = await getProfile(googleUser.uid)
      let following: string[] = []

      if (existing) {
        following = existing.following || []
      } else {
        await saveProfile({
          uid: googleUser.uid,
          display_name: googleUser.displayName,
          email: googleUser.email,
          photo_url: googleUser.photoURL,
          xp: internal.userData.xp,
          level: internal.userData.level,
          streak_days: internal.userData.streakDays,
          slider_value: internal.userData.sliderValue,
          settings: internal.userData.settings,
          achievements: internal.userData.achievements,
          following: [],
        })
      }

      const mergedUserData = { ...internal.userData, following }
      saveState({ ...internal, authMode: 'google', googleUser, userData: mergedUserData })
      set({
        authMode: 'google',
        googleUser,
        userData: computeDisplayUser('google', googleUser, mergedUserData),
      })
    },

    switchToGuest: () => {
      const internal = loadState()
      const display = computeDisplayUser('guest', null, internal.userData)
      saveState({ ...internal, authMode: 'guest', googleUser: null })
      set({ authMode: 'guest', googleUser: null, userData: display })
      supabase.auth.signOut()
    },

    advanceCard: (totalCards) => {
      const { currentCardIndex } = get()
      const next = (currentCardIndex + 1) % totalCards
      const internal = loadState()
      saveState({ ...internal, currentCardIndex: next })
      set({ currentCardIndex: next })
    },

    setFollowing: (uids) => {
      const { authMode, googleUser, userData } = get()
      const internal = loadState()
      const baseUser = authMode === 'google' && googleUser ? internal.userData : userData
      const updated = { ...baseUser, following: uids }
      const display = computeDisplayUser(authMode, googleUser, updated)
      saveState({ ...internal, userData: updated })
      set({ userData: display })
    },

    dismissConfetti: () => set({ confettiActive: false }),
    dismissAchievement: () => set({ achievementModal: null }),

    resetAllProgress: async () => {
      const { authMode, googleUser } = get()

      localStorage.removeItem(STORAGE_KEY)

      if (authMode === 'google' && googleUser) {
        await clearProfileData(googleUser.uid)
      }

      set({
        authMode: 'guest',
        googleUser: null,
        userData: { ...GUEST_USER },
        currentCardIndex: 0,
      })
    },
  }
})
