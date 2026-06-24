import { useState, useEffect, useCallback } from 'react'
import { Search, MessageCircle, ChevronRight, User, Mail, X, UserPlus, UserCheck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { searchPeople, getProfile, followUser, unfollowUser, checkIsFollowing, getFollowers, getFollowing, getApiBase } from '../services/api'
import type { PeopleUser } from '../types'
import toast from 'react-hot-toast'

export default function PeopleView({ onStartChat }: { onStartChat?: (uid: string) => void }) {
  const isMobile = useIsMobile()
  const userData = useStore((s) => s.userData)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PeopleUser[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<PeopleUser | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const users = await searchPeople(q.trim(), userData.uid)
      setResults(users)
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [userData.uid])

  const selectUser = async (uid: string) => {
    setProfileLoading(true)
    try {
      const [profile, following, followersList, followingList] = await Promise.all([
        getProfile(uid),
        checkIsFollowing(userData.uid, uid),
        getFollowers(uid),
        getFollowing(uid),
      ])
      setSelectedUser(profile)
      setIsFollowing(following)
      if (profile) {
        ;(profile as any).follower_count = followersList.length
        ;(profile as any).following_count = followingList.length
      }
    } catch {
      setSelectedUser(null)
    }
    setProfileLoading(false)
  }

  const handleFollowToggle = async () => {
    if (!selectedUser || followLoading) return
    setFollowLoading(true)
    try {
      if (isFollowing) {
        const r = await unfollowUser(userData.uid, selectedUser.uid)
        if (r.ok) setIsFollowing(false)
      } else {
        const r = await followUser(userData.uid, selectedUser.uid)
        if (r.ok) setIsFollowing(true)
      }
    } catch {
      toast.error('Failed to update follow status')
    }
    setFollowLoading(false)
  }

  return (
    <div className={`w-full ${isMobile ? 'px-4' : 'max-w-2xl mx-auto px-5'} pb-8 flex flex-col gap-4`}>
      <h2 className="text-xl font-extrabold text-white">People</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-10 py-3 md:py-2.5 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
            <X className="w-4 h-4 text-slate-500 hover:text-slate-300" />
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500 text-center">Searching...</p>}

      {!loading && results.length === 0 && query.trim() && (
        <p className="text-sm text-slate-500 text-center mt-4">No users found. Try a different name or email.</p>
      )}

      {selectedUser ? (
        <div className="bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedUser(null)} className="text-sm text-slate-400 hover:text-white transition-colors min-h-[36px]">
              &larr; Back
            </button>
          </div>
          {profileLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : selectedUser ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-2xl md:text-xl font-black text-white overflow-hidden">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url.startsWith('http') ? selectedUser.avatar_url : `${getApiBase()}${selectedUser.avatar_url}`} className="w-full h-full object-cover" alt="" />
                ) : (
                  selectedUser.display_name[0]
                )}
              </div>
              <h3 className="text-lg font-extrabold text-white">{selectedUser.display_name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Mail className="w-3 h-3" />
                <span>{selectedUser.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap justify-center">
                <span className="font-semibold text-[#7C5CFC]">Lv {selectedUser.level}</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span>{selectedUser.xp} XP</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span>{(selectedUser as any).follower_count || 0} followers</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span>{(selectedUser as any).following_count || 0} following</span>
              </div>
              <div className="flex items-center gap-2 mt-2 w-full">
                <button
                  onClick={() => onStartChat?.(selectedUser.uid)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 md:py-2.5 bg-[#7C5CFC] hover:bg-[#6D4FF2] rounded-xl text-sm font-bold text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Send Message
                </button>
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isFollowing
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30'
                      : 'bg-[#0D0B18] text-slate-300 border border-[#2D2A3E] hover:border-[#7C5CFC]/50'
                  }`}
                >
                  {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((u) => (
            <button
              key={u.uid}
              onClick={() => selectUser(u.uid)}
              className="w-full flex items-center gap-3 px-4 py-4 md:py-3 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                {u.avatar_url ? (
                  <img src={u.avatar_url.startsWith('http') ? u.avatar_url : `${getApiBase()}${u.avatar_url}`} className="w-full h-full object-cover" alt="" />
                ) : (
                  u.display_name[0]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{u.display_name}</p>
                <p className="text-xs text-slate-500 truncate">{u.email || 'No email'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-[#7C5CFC]">Lv {u.level}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
