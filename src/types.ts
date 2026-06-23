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

export interface UserData {
  displayName: string
  email: string
  photoURL: string
  uid: string
  xp: number
  level: number
  streakDays: number
  sliderValue: number
  settings: {
    notifications: boolean
    privacy: boolean
    general1: boolean
    general2: boolean
    general3: boolean
  }
  achievements: string[]
  following: string[]
}

export interface PublicUser {
  uid: string
  displayName: string
  email: string
  photoURL: string
}
