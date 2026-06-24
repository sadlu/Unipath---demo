import type { PeopleUser, Conversation, ChatMessage } from '../types'

const DEFAULT_PROD_URL = 'https://unipath-proxy.fouadazad1234.workers.dev'

export function getApiBase(): string {
  if (import.meta.env.PROD) return DEFAULT_PROD_URL
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  return 'http://localhost:8000'
}

export interface BackendSearchResult {
  title: string
  url: string
  snippet: string
  source_site: string
}

export interface BackendSearchResponse {
  query: string
  answer: string | null
  results: BackendSearchResult[]
  error: string | null
}

export async function searchOpportunities(query: string, maxResults = 8): Promise<BackendSearchResponse> {
  const params = new URLSearchParams({ q: query, max_results: String(maxResults) })
  const res = await fetch(`${getApiBase()}/api/search?${params}`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Search API error: ${res.status}`)
  const data: BackendSearchResponse = await res.json()
  if (data.error) {
    const lower = data.error.toLowerCase()
    if (lower.includes('token') || lower.includes('ratelimit')) {
      data.error = 'Search is temporarily unavailable. Please try again later.'
    }
  }
  return data
}

export async function chatQuery(query: string, maxResults = 8): Promise<BackendSearchResponse> {
  const res = await fetch(`${getApiBase()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, max_results: maxResults }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Chat API error: ${res.status}`)
  return res.json()
}

export interface LocalIndexStatus {
  exists: boolean
  bytes: number
  sources: number
  scraped_at: string | null
}

export async function getLocalIndexStatus(): Promise<LocalIndexStatus> {
  const res = await fetch(`${getApiBase()}/api/local-index/status`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Local index status error: ${res.status}`)
  return res.json()
}

export async function askLocalIndex(question: string): Promise<string> {
  const res = await fetch(`${getApiBase()}/api/local-index/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Local index ask error: ${res.status}`)
  const data = await res.json()
  return data.answer as string
}

export interface DiscoveredOpportunity {
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
  registrationDeadline: string
  cost: string
  eligibility: string
  skills: string
}

export interface DiscoverResponse {
  opportunities: DiscoveredOpportunity[]
  error: string | null
}

export async function discoverOpportunities(subjects: string[], limit = 20): Promise<DiscoverResponse> {
  const params = new URLSearchParams({ subjects: subjects.join(','), limit: String(limit) })
  const res = await fetch(`${getApiBase()}/api/discover?${params}`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Discover API error: ${res.status}`)
  return res.json()
}

export async function triggerLocalIndexScrape(): Promise<string> {
  const res = await fetch(`${getApiBase()}/api/local-index/scrape`, {
    method: 'POST',
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`Local index scrape error: ${res.status}`)
  const data = await res.json()
  return data.message as string
}

/* ── People & Chat API ── */

export async function initPeopleUser(uid: string, displayName: string, email = ''): Promise<void> {
  await fetch(`${getApiBase()}/api/people/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, display_name: displayName, email }),
  })
}

export async function registerEmail(uid: string, email: string, displayName: string): Promise<{ ok: boolean; code?: string; error?: string }> {
  const res = await fetch(`${getApiBase()}/api/people/register-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, email, display_name: displayName }),
  })
  return res.json()
}

export async function verifyEmail(email: string, code: string, uid: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${getApiBase()}/api/people/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, uid }),
  })
  return res.json()
}

export async function searchPeople(query: string, excludeUid = ''): Promise<PeopleUser[]> {
  const params = new URLSearchParams({ q: query, exclude_uid: excludeUid })
  const res = await fetch(`${getApiBase()}/api/people/search?${params}`)
  const data = await res.json()
  return data.users || []
}

export async function getProfile(uid: string): Promise<PeopleUser | null> {
  const res = await fetch(`${getApiBase()}/api/people/profile/${uid}`)
  const data = await res.json()
  return data.user || null
}

export async function sendMessage(fromUid: string, toUid: string, content: string, imageUrl = ''): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  const res = await fetch(`${getApiBase()}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_uid: fromUid, to_uid: toUid, content, image_url: imageUrl }),
  })
  return res.json()
}

export async function getConversations(uid: string): Promise<Conversation[]> {
  const res = await fetch(`${getApiBase()}/api/chat/conversations?uid=${uid}`)
  const data = await res.json()
  return data.conversations || []
}

export async function getMessages(uidA: string, uidB: string): Promise<ChatMessage[]> {
  const res = await fetch(`${getApiBase()}/api/chat/messages?uid_a=${uidA}&uid_b=${uidB}`)
  const data = await res.json()
  return data.messages || []
}

/* ── Follow API ── */

export async function followUser(followerUid: string, followingUid: string): Promise<{ ok: boolean; following?: boolean; error?: string }> {
  const res = await fetch(`${getApiBase()}/api/people/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ follower_uid: followerUid, following_uid: followingUid }),
  })
  return res.json()
}

export async function unfollowUser(followerUid: string, followingUid: string): Promise<{ ok: boolean; following?: boolean; error?: string }> {
  const res = await fetch(`${getApiBase()}/api/people/unfollow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ follower_uid: followerUid, following_uid: followingUid }),
  })
  return res.json()
}

export async function getFollowing(uid: string): Promise<string[]> {
  const res = await fetch(`${getApiBase()}/api/people/following/${uid}`)
  const data = await res.json()
  return data.uids || []
}

export async function getFollowers(uid: string): Promise<string[]> {
  const res = await fetch(`${getApiBase()}/api/people/followers/${uid}`)
  const data = await res.json()
  return data.uids || []
}

export async function checkIsFollowing(followerUid: string, followingUid: string): Promise<boolean> {
  const res = await fetch(`${getApiBase()}/api/people/is-following?follower_uid=${followerUid}&following_uid=${followingUid}`)
  const data = await res.json()
  return data.following || false
}

/* ── Upload API ── */

export async function uploadAvatar(uid: string, file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${getApiBase()}/api/upload/avatar?uid=${uid}`, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function uploadChatImage(file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${getApiBase()}/api/upload/chat-image`, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function sendTypingIndicator(uid: string, conversationWith: string, typing: boolean): Promise<void> {
  try {
    await fetch(`${getApiBase()}/api/chat/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, conversation_with: conversationWith, typing }),
    })
  } catch {}
}

export async function getTypingStatus(uid: string, conversationWith: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/api/chat/typing/${uid}/${conversationWith}`)
    if (!res.ok) return false
    const data = await res.json()
    return data.typing || false
  } catch { return false }
}

export async function markMessagesRead(uid: string, conversationWith: string): Promise<void> {
  try {
    await fetch(`${getApiBase()}/api/chat/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_uid: uid, to_uid: conversationWith }),
    })
  } catch {}
}

export async function sendMessageWithImage(
  fromUid: string,
  toUid: string,
  content: string,
  imageUrl: string,
): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  const res = await fetch(`${getApiBase()}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_uid: fromUid, to_uid: toUid, content, image_url: imageUrl }),
  })
  return res.json()
}

export async function updateProfile(
  uid: string,
  displayName?: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${getApiBase()}/api/people/update-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, display_name: displayName || undefined }),
  })
  return res.json()
}

export interface AuthUserData {
  displayName: string
  email: string
  photoURL: string
  uid: string
  xp: number
  level: number
  streakDays: number
  sliderValue: number
  subjects: string[]
  achievements: string[]
  settings: Record<string, any>
  hasSeenTutorial: boolean
}

const TOKEN_KEY = 'unipath_auth_token'
const REFRESH_TOKEN_KEY = 'unipath_refresh_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function storeRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export async function authRefresh(refreshToken: string): Promise<{ ok: boolean; token?: string; refresh_token?: string; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15_000),
    })
    return res.json()
  } catch { return { ok: false, error: 'Server unreachable' } }
}

export async function authRegister(
  uid: string, displayName: string, password: string, subjects?: string[],
): Promise<{ ok: boolean; token?: string; refresh_token?: string; user?: AuthUserData; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, display_name: displayName, password, subjects: subjects || [] }),
      signal: AbortSignal.timeout(20_000),
    })
    return res.json()
  } catch (e: any) {
    const msg = e.name === 'TimeoutError' || e.name === 'AbortError'
      ? 'Cannot reach the backend server. Ensure the backend is running and the Server URL is correct in Settings.'
      : (e.message || 'Server unreachable')
    return { ok: false, error: msg }
  }
}

export async function authLogin(
  uid: string, password: string,
): Promise<{ ok: boolean; token?: string; refresh_token?: string; user?: AuthUserData; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, password }),
      signal: AbortSignal.timeout(20_000),
    })
    return res.json()
  } catch (e: any) {
    const msg = e.name === 'TimeoutError' || e.name === 'AbortError'
      ? 'Cannot reach the backend server. Ensure the backend is running and the Server URL is correct in Settings.'
      : (e.message || 'Server unreachable')
    return { ok: false, error: msg }
  }
}

export async function authMe(token: string): Promise<{ ok: boolean; user?: AuthUserData; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/me?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(20_000),
    })
    return res.json()
  } catch { return { ok: false, error: 'Server unreachable' } }
}

export async function authLogout(token: string): Promise<void> {
  try {
    await fetch(`${getApiBase()}/api/auth/logout?token=${encodeURIComponent(token)}`, { method: 'POST' })
  } catch {}
  clearToken()
  clearRefreshToken()
}

export async function authChangePassword(
  token: string, currentPassword: string, newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, current_password: currentPassword, new_password: newPassword }),
      signal: AbortSignal.timeout(15_000),
    })
    return res.json()
  } catch { return { ok: false, error: 'Server unreachable' } }
}

export async function authSync(token: string, data: {
  xp?: number; level?: number; streak_days?: number;
  subjects?: string[]; slider_value?: number;
  achievements?: string[]; settings?: Record<string, any>;
}): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...data }),
      signal: AbortSignal.timeout(15_000),
    })
    const d = await res.json()
    return d.ok === true
  } catch { return false }
}

export async function fetchPublicUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/public-url`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const data = await res.json()
    return data.url || null
  } catch { return null }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/api/health`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch { return false }
}

/* ── CV Coach API ── */

export interface CVAdviseResponse {
  query: string
  answer: string | null
  provider: string | null
  error: string | null
}

export async function cvAdvise(
  uid: string,
  query: string,
  conversationHistory: { role: string; content: string }[] = [],
): Promise<CVAdviseResponse> {
  const res = await fetch(`${getApiBase()}/api/cv/advise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, query, conversation_history: conversationHistory }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`CV API error: ${res.status}`)
  return res.json()
}
