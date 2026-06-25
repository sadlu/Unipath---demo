import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { motion } from 'framer-motion'
import { Sparkles, Briefcase, MapPin, Link as LinkIcon, Trophy, Compass } from 'lucide-react'
import AnimatedNumber from '../components/AnimatedNumber'
import FloatingCrystal from '../components/FloatingCrystal'
import { discoverOpportunities } from '../services/api'
import type { DiscoveredOpportunity } from '../services/api'

const MAX_LEVEL_XP = 200

function openExternal(url: string) {
  if (!url) return
  if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url)
  else window.open(url, '_blank')
}

function CircularXPProgress({ pct, size = 100 }: { pct: number; size?: number }) {
  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <defs>
        <linearGradient id="xpRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#7C5CFC" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,240,255,0.08)" strokeWidth="6" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#xpRing)"
        strokeWidth="6"
        strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${(pct / 100) * circ} ${circ}` }}
        transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

function ShimmerCard() {
  return (
    <div className="shrink-0 w-44 h-48 holo-glass rounded-xl overflow-hidden">
      <div className="h-full w-full shimmer rounded-xl" />
    </div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
}

export default function HomeView() {
  const isMobile = useIsMobile()
  const userData = useStore((s) => s.userData)
  const setView = useStore((s) => s.setView)
  const displayName = userData?.displayName || 'Fouad'
  const xp = userData?.xp ?? 0
  const fillPercent = Math.min((xp / MAX_LEVEL_XP) * 100, 100)
  const subjects = userData.subjects?.length ? userData.subjects : ['opportunity']

  const [picks, setPicks] = useState<DiscoveredOpportunity[]>([])
  const [picksLoading, setPicksLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setPicksLoading(true)
    discoverOpportunities(subjects, 12)
      .then((data) => {
        if (!cancelled && !data.error && data.opportunities.length > 0) setPicks(data.opportunities.slice(0, 8))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPicksLoading(false) })
    return () => { cancelled = true }
  }, [subjects])

  return (
    <motion.div
      className={`w-full ${isMobile ? '' : 'max-w-2xl mx-auto px-5'} flex flex-col gap-5 md:gap-6 pt-4`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className={`flex items-center justify-between ${isMobile ? 'px-4' : ''}`}>
        <div className="flex-1">
          <motion.h2
            className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight text-balance leading-tight"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            Hey{' '}
            <span className="bg-gradient-to-r from-[#00F0FF] via-[#7C5CFC] to-[#F59E0B] bg-clip-text text-transparent">
              {displayName}
            </span>
          </motion.h2>
          <p className="text-sm text-slate-500 mt-1">Your universe of opportunities awaits.</p>
        </div>
        {!isMobile && <FloatingCrystal size={70} />}
      </motion.div>

      {isMobile ? (
        <div className="w-full px-4 py-5 pedestal">
          <div className="flex items-center gap-4">
            <CircularXPProgress pct={fillPercent} size={72} />
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-xs font-bold text-[#00F0FF]/60">Level {userData?.level ?? 1}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-white">{xp}</span>
                <span className="text-[11px] text-slate-500">/ {MAX_LEVEL_XP} XP</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#00F0FF] to-[#7C5CFC] rounded-full" style={{ width: `${fillPercent}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-[#00F0FF]">{Math.round(fillPercent)}%</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          variants={itemVariants}
          className="holo-glass-strong rounded-2xl p-5 flex items-center gap-5 neon-glow-cyan"
        >
          <div className="relative shrink-0">
            <CircularXPProgress pct={fillPercent} size={100} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#00F0FF]" />
            </div>
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-[#00F0FF]/40"
                style={{ top: `${15 + i * 25}%`, left: `${10 + i * 20}%` }}
                animate={{ y: [-4, 4, -4], opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">Level {userData?.level ?? 1}</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white"><AnimatedNumber value={xp} /></span>
              <span className="text-xs text-slate-500">/ {MAX_LEVEL_XP} XP</span>
            </div>
            <motion.div
              className="text-xs font-semibold text-[#00F0FF] bg-[#00F0FF]/10 px-2.5 py-0.5 rounded-full w-fit"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {Math.round(fillPercent)}% to next level
            </motion.div>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className={`flex items-center justify-between ${isMobile ? 'px-4' : ''}`}>
        <h3 className="text-base md:text-lg font-bold text-white">Today's Picks</h3>
        {picks.length > 0 && (
          <button onClick={() => setView('discover')} className="neon-btn text-xs font-semibold text-white px-4 py-2 rounded-lg">
            View all &rarr;
          </button>
        )}
      </motion.div>

      {picksLoading ? (
        isMobile ? (
          <div className="flex flex-col px-4 gap-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer" style={{ height: 72, borderRadius: 0 }} />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 md:-mx-5 px-4 md:px-5 scrollbar-none">
            {[1, 2, 3].map((i) => <ShimmerCard key={i} />)}
          </div>
        )
      ) : picks.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className={isMobile ? 'flex flex-col items-center gap-4 text-center px-4 py-8' : 'holo-glass rounded-2xl p-8 flex flex-col items-center gap-4 text-center'}
        >
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <Compass className="w-16 h-16 text-slate-600" />
          </motion.div>
          <p className="text-sm text-slate-500">No picks right now</p>
          <motion.button
            onClick={() => setView('discover')}
            className="neon-btn px-6 py-2.5 rounded-xl text-sm font-bold text-white"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Explore Opportunities
          </motion.button>
        </motion.div>
      ) : isMobile ? (
        <div className="flex flex-col">
          {picks.map((pick, i) => (
            <motion.div
              key={pick.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-[#00F0FF]/5 cursor-pointer active:bg-white/5 holo-shimmer"
              onClick={() => pick.applyUrl && openExternal(pick.applyUrl)}
            >
              <div className="w-12 h-12 rounded-xl holo-glass flex items-center justify-center text-xl shrink-0">
                {pick.imageIcon || '\uD83C\uDF0D'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white leading-snug line-clamp-1">{pick.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{pick.organization}</p>
                {pick.tags[0] && (
                  <span className="inline-flex items-center px-1.5 py-0.5 mt-1 text-[9px] font-bold bg-[#00F0FF]/10 text-[#00F0FF] rounded-md uppercase tracking-wider">
                    {pick.tags[0]}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
                  <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(0,240,255,0.06)" strokeWidth="3" />
                  <motion.circle cx="16" cy="16" r="13" fill="none" stroke="#00F0FF" strokeWidth="3" strokeLinecap="round"
                    initial={{ strokeDasharray: `0 ${81.6}` }}
                    animate={{ strokeDasharray: `${(pick.matchPercentage / 100) * 81.6} ${81.6}` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    transform="rotate(-90 16 16)"
                  />
                </svg>
                <span className="text-[9px] font-semibold text-[#00F0FF]">{pick.matchPercentage}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 md:-mx-5 px-4 md:px-5 snap-x snap-mandatory scrollbar-none">
          {picks.map((pick, i) => (
            <motion.div
              key={pick.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="snap-start shrink-0 w-40 md:w-44 holo-glass rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-all duration-300 holo-shimmer"
              whileHover={{ y: -4, borderColor: 'rgba(0, 240, 255, 0.3)', boxShadow: '0 8px 24px rgba(0, 240, 255, 0.15)' }}
              onClick={() => pick.applyUrl && openExternal(pick.applyUrl)}
            >
              <div className="flex items-start justify-between">
                <span className="text-lg leading-none">{pick.imageIcon || '\uD83C\uDF0D'}</span>
                <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(0,240,255,0.06)" strokeWidth="3" />
                  <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#00F0FF" strokeWidth="3" strokeLinecap="round"
                    initial={{ strokeDasharray: `0 ${94.2}` }}
                    animate={{ strokeDasharray: `${(pick.matchPercentage / 100) * 94.2} ${94.2}` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    transform="rotate(-90 18 18)"
                  />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-white leading-snug line-clamp-2 mt-1">{pick.title}</h4>
              <div className="flex items-center gap-1 mt-auto">
                <Briefcase className="w-3 h-3 text-slate-500" />
                <p className="text-[11px] text-slate-500 truncate">{pick.organization}</p>
              </div>
              {pick.tags[0] && (
                <span className="self-start inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 rounded-md uppercase tracking-wider">
                  {pick.tags[0]}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
