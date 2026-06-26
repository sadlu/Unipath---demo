import type { PeopleUser, Conversation, ChatMessage } from '../types'
import { isElectron, isCapacitor } from '../lib/platform'

const REMOTE_FALLBACK = 'https://unipath-app.fly.dev'

const CANDIDATE_URLS = [
  'https://09aa-110-44-116-125.ngrok-free.app',
  REMOTE_FALLBACK,
  'https://unipath-proxy.fouadazad1234.workers.dev',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]

const STORAGE_KEY = 'unipath_api_url'

let _customBase: string | null = null
let _discoveredBase: string | null = null
let _discoveryInProgress: Promise<string | null> | null = null

export function setApiBase(url: string) {
  _customBase = url
  if (url) localStorage.setItem(STORAGE_KEY, url)
}

export function getApiBase(): string {
  if (_customBase) return _customBase
  if (_discoveredBase) return _discoveredBase
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return stored
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  if (isElectron()) {
    return 'http://localhost:8000'
  }
  if (isCapacitor()) {
    return REMOTE_FALLBACK
  }
  if (import.meta.env.PROD && window.location.protocol !== 'file:') {
    return window.location.origin
  }
  return 'http://localhost:8000'
}

export function getRemoteFallbackBase(): string {
  return _customBase || _discoveredBase || import.meta.env.VITE_API_URL || REMOTE_FALLBACK
}

async function tryHealth(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(timeoutMs) })
    return res.ok
  } catch {
    return false
  }
}

export async function discoverApiBase(): Promise<string | null> {
  if (_discoveryInProgress) return _discoveryInProgress
  if (_customBase) {
    _discoveredBase = _customBase
    return _customBase
  }
  _discoveryInProgress = (async () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const alive = await tryHealth(stored, 3000)
      if (alive) {
        _discoveredBase = stored
        return stored
      }
    }
    const results = await Promise.allSettled(
      CANDIDATE_URLS.map(url => tryHealth(url).then(ok => (ok ? url : null)))
    )
    const liveUrl = results.find(
      r => r.status === 'fulfilled' && r.value !== null
    ) as PromiseFulfilledResult<string> | undefined
    if (liveUrl) {
      _discoveredBase = liveUrl.value
      localStorage.setItem(STORAGE_KEY, liveUrl.value)
      return liveUrl.value
    }
    if (stored) {
      _discoveredBase = stored
      return stored
    }
    return null
  })()
  const result = await _discoveryInProgress
  _discoveryInProgress = null
  return result
}

export function getDiscoveredBase(): string | null {
  return _discoveredBase
}

export function resetDiscoveredBase() {
  _discoveredBase = null
  localStorage.removeItem(STORAGE_KEY)
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
  cached?: boolean
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
  verified: boolean
  verified_at: string
}

export interface DiscoverResponse {
  opportunities: DiscoveredOpportunity[]
  total: number
  offset: number
  limit: number
  error: string | null
}

export async function discoverOpportunities(subjects: string[], limit = 20, offset = 0): Promise<DiscoverResponse> {
  const params = new URLSearchParams({ subjects: subjects.join(','), limit: String(limit), offset: String(offset) })
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
    return await tryFetchWithFallback('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch { return { ok: false, error: 'Server unreachable' } }
}

export async function authRegister(
  uid: string, displayName: string, password: string, subjects?: string[],
): Promise<{ ok: boolean; token?: string; refresh_token?: string; user?: AuthUserData; error?: string }> {
  try {
    return await tryFetchWithFallback('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, display_name: displayName, password, subjects: subjects || [] }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e: any) {
    return { ok: false, error: e.message || 'Server unreachable' }
  }
}

async function tryFetchWithFallback(
  path: string,
  init: RequestInit,
  retries = 1,
): Promise<{ ok: boolean; token?: string; refresh_token?: string; user?: AuthUserData; error?: string }> {
  let bases = [getApiBase()]
  const fallback = getRemoteFallbackBase()
  if (fallback && fallback !== bases[0]) bases.push(fallback)
  const discovered = getDiscoveredBase()
  if (discovered && !bases.includes(discovered)) bases.unshift(discovered)
  const seen = new Set<string>()
  for (const base of bases) {
    if (seen.has(base)) continue
    seen.add(base)
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${base}${path}`, {
          ...init,
          signal: init.signal || AbortSignal.timeout(20_000),
        })
        const text = await res.text()
        const data = JSON.parse(text)
        if (data.ok !== undefined) {
          if (discovered !== base) {
            _discoveredBase = base
            localStorage.setItem(STORAGE_KEY, base)
          }
          return data
        }
      } catch {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000))
        }
      }
    }
  }
  return { ok: false, error: 'Server not responding — check your internet connection or try again later.' }
}

export async function authLogin(
  uid: string, password: string,
): Promise<{ ok: boolean; token?: string; refresh_token?: string; user?: AuthUserData; error?: string }> {
  try {
    return await tryFetchWithFallback('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, password }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e: any) {
    return { ok: false, error: e.message || 'Server unreachable' }
  }
}

export async function authMe(token: string): Promise<{ ok: boolean; user?: AuthUserData; error?: string }> {
  try {
    return await tryFetchWithFallback(`/api/auth/me?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(20_000),
    })
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
    return await tryFetchWithFallback('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, current_password: currentPassword, new_password: newPassword }),
      signal: AbortSignal.timeout(15_000),
    })
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

/* ── Feedback API ── */

export async function submitFeedback(
  uid: string,
  feedbackType: string,
  targetId: string,
  rating: number,
  comment = '',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, feedback_type: feedbackType, target_id: targetId, rating, comment }),
    })
    return res.json()
  } catch {
    return { ok: false, error: 'Server unreachable' }
  }
}

export async function getFeedbackStats(feedbackType: string, targetId: string): Promise<{ up: number; down: number; total: number; score: number }> {
  try {
    const res = await fetch(`${getApiBase()}/api/feedback/stats?feedback_type=${feedbackType}&target_id=${targetId}`)
    return res.json()
  } catch {
    return { up: 0, down: 0, total: 0, score: 0 }
  }
}

/* ── Forgot Password API ── */

export async function forgotPassword(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/forgot-password?email=${encodeURIComponent(email)}`, {
      method: 'POST',
    })
    return res.json()
  } catch {
    return { ok: false, error: 'Server unreachable' }
  }
}

export async function resetPassword(resetToken: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/reset-password?reset_token=${encodeURIComponent(resetToken)}&new_password=${encodeURIComponent(newPassword)}`, {
      method: 'POST',
    })
    return res.json()
  } catch {
    return { ok: false, error: 'Server unreachable' }
  }
}

/* ── Data Export / Delete API ── */

export async function exportUserData(uid: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/people/export?uid=${encodeURIComponent(uid)}`, {
      method: 'POST',
    })
    return res.json()
  } catch {
    return { ok: false, error: 'Server unreachable' }
  }
}

export async function deleteAccount(uid: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/people/delete?uid=${encodeURIComponent(uid)}`, {
      method: 'POST',
    })
    return res.json()
  } catch {
    return { ok: false, error: 'Server unreachable' }
  }
}

/* ── WebSocket Chat ── */

let _ws: WebSocket | null = null
let _wsCallbacks: Map<string, (data: any) => void> = new Map()
let _wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

export function connectWebSocket(uid: string): WebSocket {
  if (_ws && _ws.readyState === WebSocket.OPEN) return _ws

  const base = getApiBase().replace(/^http/, 'ws')
  _ws = new WebSocket(`${base}/ws/${uid}`)

  _ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      _wsCallbacks.forEach((cb) => cb(data))
    } catch {}
  }

  _ws.onclose = () => {
    _ws = null
    if (_wsReconnectTimer) clearTimeout(_wsReconnectTimer)
    _wsReconnectTimer = setTimeout(() => connectWebSocket(uid), 3000)
  }

  _ws.onerror = () => {
    _ws?.close()
  }

  return _ws
}

export function sendWSMessage(data: Record<string, any>) {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(data))
  }
}

export function onWSMessage(callback: (data: any) => void): () => void {
  const id = `cb_${Date.now()}_${Math.random()}`
  _wsCallbacks.set(id, callback)
  return () => { _wsCallbacks.delete(id) }
}

export function disconnectWebSocket() {
  if (_ws) {
    _ws.close()
    _ws = null
  }
  if (_wsReconnectTimer) {
    clearTimeout(_wsReconnectTimer)
    _wsReconnectTimer = null
  }
  _wsCallbacks.clear()
}
