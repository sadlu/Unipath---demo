export interface Opportunity {
  id: number
  title: string
  description: string
  tags: string[]
  organization: string
  location: string
  coordinates: { lat: number; lng: number }
  startDate: string
  applyUrl: string
  matchPercentage: number
  imageIcon: string
}

export interface UserSettings {
  notifications: boolean
  pushNotifications: boolean
  emailAlerts: boolean
  inAppSounds: boolean
  soundVolume: number
  shareAnalytics: boolean
  onlineStatus: boolean
  autoSave: boolean
  desktopNotifications: boolean
  reduceMotion: boolean
}

export interface UserData {
  displayName: string
  email: string
  photoURL: string
  uid: string
  xp: number
  level: number
  streakDays: number
  sliderValue: number
  settings: UserSettings
  achievements: string[]
  subjects: string[]
  hasSeenTutorial: boolean
}

export interface LocalEvent {
  id: string
  title: string
  description: string
  date: string
  venue: string
  source: 'Facebook' | 'Reddit' | 'Kathmandu Post' | 'Events Nepal' | 'E-Kantipur' | 'Tourism Board'
  sourceUrl: string
  coordinates: { lat: number; lng: number }
}

export type ThemeMode = 'dark' | 'light' | 'system'

export interface AppPreferences {
  theme: ThemeMode
  accentColor: string
  language: string
}

export interface PeopleUser {
  uid: string
  display_name: string
  email: string
  email_verified: number
  avatar_url: string
  xp: number
  level: number
  last_seen: string
}

export interface Conversation {
  other_uid: string
  last_message: string
  last_time: string
  unread: number
  display_name: string
  email: string
  other_verified: boolean
}

export interface ChatMessage {
  id: number
  from_uid: string
  to_uid: string
  content: string
  image_url: string
  created_at: string
  read: number
}
