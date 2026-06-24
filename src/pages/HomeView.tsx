import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../store/useStore'
import { motion } from 'framer-motion'
import { Sparkles, Briefcase, MapPin, Link as LinkIcon, Trophy } from 'lucide-react'
import AnimatedNumber from '../components/AnimatedNumber'
import { discoverOpportunities } from '../services/api'
import type { DiscoveredOpportunity } from '../services/api'

const MAX_LEVEL_XP = 200

function openExternal(url: string) {
  if (!url) return
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

function CircularProgress({ pct, size = 40 }: { pct: number; size?: number }) {
  const r = size / 2 - 3
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#progressRing)"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${(pct / 100) * circ} ${circ}` }}
        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id="progressRing" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C5CFC" />
          <stop offset="100%" stopColor="#6EE7B7" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function HomeView() {
  const userData = useStore((s) => s.userData)
  const setView = useStore((s) => s.setView)
  const displayName = userData?.displayName || 'Fouad'
  const xp = userData?.xp ?? 0
  const fillPercent = Math.min((xp / MAX_LEVEL_XP) * 100, 100)
  const subjects = userData.subjects?.length ? userData.subjects : ['opportunity']

  const [picks, setPicks] = useState<DiscoveredOpportunity[]>([])
  const [picksLoading, setPicksLoading] = useState(true)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    setPicksLoading(true)
    discoverOpportunities(subjects, 12)
      .then((data) => {
        if (!data.error && data.opportunities.length > 0) {
          setPicks(data.opportunities.slice(0, 8))
        }
      })
      .catch(() => {})
      .finally(() => setPicksLoading(false))
  }, [subjects])

  return (
    <div className="w-full max-w-2xl mx-auto px-5 flex flex-col gap-5 pt-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-display font-extrabold text-gradient-gold tracking-tight text-balance leading-tight">
          Hey {displayName}
        </h2>
        <p className="text-sm text-slate-500 mt-1">Your opportunities, curated for today.</p>
      </motion.div>

      <motion.div
        className="glass-card-strong rounded-2xl p-5 flex flex-col sm:flex-row gap-5 glow-purple"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="shrink-0 w-full sm:w-24 h-20 sm:h-24 rounded-xl bg-gradient-to-br from-[#7C5CFC]/20 to-[#6EE7B7]/10 border border-[#7C5CFC]/20 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-[#7C5CFC]" />
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-display font-bold text-white">Progress Tracker</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Level {userData?.level ?? 1} &middot; <AnimatedNumber value={xp} /> / {MAX_LEVEL_XP} XP
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-[#7C5CFC]/20 text-[#7C5CFC] border border-[#7C5CFC]/30 rounded-full">
              Lv {userData?.level ?? 1}
            </span>
          </div>
          <div className="relative w-full h-2.5 bg-[#0D0B18] rounded-full overflow-hidden mt-1">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #7C5CFC, #6EE7B7)',
                boxShadow: '0 0 12px rgba(124,92,252,0.4), 0 0 24px rgba(110,231,183,0.2)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${fillPercent}%` }}
              transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
            />
            <motion.div
              className="absolute -top-7 bg-[#1E1B2E] border border-[#2D2A3E] rounded-lg px-2 py-1 text-[10px] font-bold text-white shadow-xl"
              initial={{ opacity: 0, left: '0%' }}
              animate={{ opacity: 1, left: `${fillPercent}%` }}
              transition={{ duration: 0.6, delay: 0.5 }}
              style={{ transform: 'translateX(-50%)' }}
            >
              {xp} XP
            </motion.div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h3 className="text-lg font-display font-bold text-white">Today's Picks</h3>
        {picks.length > 0 && (
          <button
            onClick={() => setView('discover')}
            className="text-xs font-semibold text-[#7C5CFC] hover:text-[#8D6CFF] transition-colors"
          >
            View all &rarr;
          </button>
        )}
      </motion.div>

      {picksLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shrink-0 w-44 h-44 glass-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : picks.length === 0 ? (
        <p className="text-sm text-slate-500">No picks right now. Head to Discover to find opportunities.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 snap-x snap-mandatory scrollbar-none">
          {picks.map((pick) => (
            <motion.div
              key={pick.id}
              className="snap-start shrink-0 w-44 glass-card rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-all duration-300"
              whileHover={{
                y: -4,
                borderColor: 'rgba(124, 92, 252, 0.3)',
                boxShadow: '0 8px 24px rgba(124, 92, 252, 0.15)',
              }}
              onClick={() => pick.applyUrl && openExternal(pick.applyUrl)}
            >
              <div className="flex items-start justify-between">
                <span className="text-lg leading-none">{pick.imageIcon || '\uD83C\uDF0D'}</span>
                <CircularProgress pct={pick.matchPercentage} size={36} />
              </div>
              <h4 className="text-sm font-bold text-white leading-snug line-clamp-2 mt-1">{pick.title}</h4>
              <div className="flex items-center gap-1 mt-auto">
                <Briefcase className="w-3 h-3 text-slate-500" />
                <p className="text-[11px] text-slate-500 truncate">{pick.organization}</p>
              </div>
              {pick.tags[0] && (
                <span className="self-start inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md uppercase tracking-wider">
                  {pick.tags[0]}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
