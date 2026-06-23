import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mdyejzxzxuneazwerefc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1keWVqenh6eHVuZWF6d2VyZWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODI1NzksImV4cCI6MjA5Nzc1ODU3OX0.xJI5Z4Nv7qGajKFw0RpwRKddk6vKhNbrvQSn8ooxzZk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function signInWithGoogle() {
  if (window.electronAPI?.oauthSignIn) {
    return signInWithGoogleElectron()
  }
  if (window.electronAPI) {
    return { data: null, error: new Error('Sign-in interface not found. Please restart the app.') }
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  return { data, error }
}

async function signInWithGoogleElectron() {
  const api = window.electronAPI!
  const redirectTo = window.location.origin

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  })

  if (error || !data?.url) {
    return { data, error }
  }

  try {
    await api.oauthSignIn(data.url)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in window was closed before completing auth.'
    return { data: null, error: new Error(message) }
  }

  for (let i = 0; i < 10; i++) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      return { data: { provider: 'google', url: '' }, error: null }
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  return { data: null, error: new Error('Authentication completed but session was not found. Please try again.') }
}

export interface Profile {
  uid: string
  display_name: string
  email: string
  photo_url: string
  xp: number
  level: number
  streak_days: number
  slider_value: number
  settings: Record<string, boolean>
  achievements: string[]
  following: string[]
}

export async function saveProfile(profile: Profile) {
  const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'uid' })
  if (error) console.error('[Supabase] saveProfile error:', error)
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', uid)
    .single()
  if (error) return null
  return data as Profile
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('display_name', `${query}%`)
  if (error) return []
  return (data as Profile[]) || []
}

export async function followProfile(currentUid: string, targetUid: string) {
  const profile = await getProfile(currentUid)
  if (!profile) return
  const following = [...(profile.following || []), targetUid]
  await supabase.from('profiles').update({ following }).eq('uid', currentUid)
}

export async function unfollowProfile(currentUid: string, targetUid: string) {
  const profile = await getProfile(currentUid)
  if (!profile) return
  const following = (profile.following || []).filter((uid) => uid !== targetUid)
  await supabase.from('profiles').update({ following }).eq('uid', currentUid)
}

export async function getProfileFollowing(uid: string): Promise<string[]> {
  const profile = await getProfile(uid)
  return profile?.following || []
}

export async function clearProfileData(uid: string) {
  await supabase
    .from('profiles')
    .update({
      xp: 0,
      level: 1,
      streak_days: 0,
      slider_value: 50,
      settings: {
        notifications: true,
        privacy: false,
        general1: true,
        general2: true,
        general3: true,
      },
      achievements: [],
      following: [],
    })
    .eq('uid', uid)
}
