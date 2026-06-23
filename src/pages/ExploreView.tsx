import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { searchProfiles, followProfile, unfollowProfile, getProfileFollowing } from '../supabaseClient'
import { Search, UserPlus, UserMinus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PublicUser } from '../types'

export default function ExploreView() {
  const authMode = useStore((s) => s.authMode)
  const userData = useStore((s) => s.userData)
  const setFollowing = useStore((s) => s.setFollowing)

  const [queryText, setQueryText] = useState('')
  const [results, setResults] = useState<PublicUser[]>([])
  const [loading, setLoading] = useState(false)
  const [followingMap, setFollowingMap] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (authMode !== 'google' || !userData.uid) return
    getProfileFollowing(userData.uid).then((uids) => {
      setFollowingMap(new Set(uids))
      setFollowing(uids)
    }).catch(() => {})
  }, [authMode, userData.uid, setFollowing])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const profiles = await searchProfiles(q)
      setResults(
        profiles
          .filter((p) => p.uid !== userData.uid)
          .map((p) => ({
            uid: p.uid,
            displayName: p.display_name,
            email: p.email,
            photoURL: p.photo_url,
          }))
      )
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [userData.uid])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(queryText), 300)
    return () => clearTimeout(timer)
  }, [queryText, doSearch])

  async function handleFollow(targetUid: string) {
    if (authMode !== 'google') {
      toast('Create a Google Account to follow users!', { icon: '\u2139\uFE0F', duration: 3000 })
      return
    }

    const isFollowing = followingMap.has(targetUid)
    try {
      if (isFollowing) {
        await unfollowProfile(userData.uid, targetUid)
        followingMap.delete(targetUid)
      } else {
        await followProfile(userData.uid, targetUid)
        followingMap.add(targetUid)
      }
      setFollowingMap(new Set(followingMap))
      setFollowing(Array.from(followingMap))
      toast(isFollowing ? 'Unfollowed' : 'Followed!', { duration: 2000 })
    } catch {
      toast.error('Failed to update follow status')
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-5 flex flex-col gap-5 pb-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Explore</h2>
        <p className="text-sm text-slate-400">Discover and connect with other users.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search users by name..."
          className="w-full pl-11 pr-4 py-3 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#7C5CFC] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && queryText && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
          <Search className="w-8 h-8" />
          <p className="text-sm">No users found matching "{queryText}"</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((u) => {
            const isFollowing = followingMap.has(u.uid)
            return (
              <div
                key={u.uid}
                className="flex items-center gap-3 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl p-4"
              >
                {u.photoURL ? (
                  <img
                    src={u.photoURL}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-[#7C5CFC]/30 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {u.displayName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{u.displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <button
                  onClick={() => handleFollow(u.uid)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 shrink-0 ${
                    isFollowing
                      ? 'bg-[#0D0B18] border border-[#2D2A3E] text-slate-400 hover:border-rose-900/30 hover:text-rose-400'
                      : 'bg-[#7C5CFC] hover:bg-[#8D6CFF] text-white shadow-lg shadow-[#7C5CFC]/20'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-3 h-3" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!queryText && !loading && (
        <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <Search className="w-10 h-10 opacity-30" />
          <p className="text-sm">Type a name to search for users</p>
        </div>
      )}
    </div>
  )
}
