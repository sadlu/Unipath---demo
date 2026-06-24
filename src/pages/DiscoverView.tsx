import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { X, Heart, MapPin, Calendar, Briefcase, Link as LinkIcon, ChevronDown, ChevronUp, RefreshCw, Clock, DollarSign, Users, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useStore } from '../store/useStore'
import { discoverOpportunities } from '../services/api'
import type { DiscoveredOpportunity } from '../services/api'

function openExternal(url: string) {
  if (!url) return
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

const MAX_DESC_LENGTH = 120

const SUBJECT_ICONS: Record<string, string> = {
  science: '\uD83D\uDD2C',
  technology: '\uD83D\uDCBB',
  engineering: '\u2699\uFE0F',
  mathematics: '\uD83D\uDCCA',
  medicine: '\uD83C\uDFE5',
  arts: '\uD83C\uDFA8',
  business: '\uD83D\uDCCA',
  law: '\u2696\uFE0F',
  education: '\uD83D\uDCDA',
  agriculture: '\uD83C\uDF31',
  default: '\uD83C\uDF0D',
}

function getIcon(subjects: string[]): string {
  for (const s of subjects) {
    const icon = SUBJECT_ICONS[s.toLowerCase()]
    if (icon) return icon
  }
  return SUBJECT_ICONS.default
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 40 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
  },
  exit: {
    opacity: 0, scale: 0.85, y: -20,
    transition: { duration: 0.2 },
  },
}

const staggerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] },
  },
}

function DetailBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null
  return (
    <motion.div variants={itemVariants} className="flex items-start gap-2 p-3 rounded-xl bg-[#0D0B18]/80 border border-[#2D2A3E]/40">
      <div className="mt-0.5 text-[#7C5CFC] shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-200 leading-snug">{value}</p>
      </div>
    </motion.div>
  )
}

export default function DiscoverView() {
  const currentCardIndex = useStore((s) => s.currentCardIndex)
  const advanceCard = useStore((s) => s.advanceCard)
  const addXP = useStore((s) => s.addXP)
  const userData = useStore((s) => s.userData)
  const [expanded, setExpanded] = useState(false)
  const [cards, setCards] = useState<DiscoveredOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragX, setDragX] = useState(0)
  const retryCountRef = useRef(0)

  const subjects = userData.subjects?.length ? userData.subjects : ['opportunity']

  const fetchCards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await discoverOpportunities(subjects, 20)
      retryCountRef.current = 0
      if (data.error) {
        setError(data.error)
        setCards([])
      } else if (data.opportunities.length === 0) {
        setError('No opportunities found. Try adding more subjects.')
        setCards([])
      } else {
        setCards(data.opportunities)
      }
    } catch (e) {
      if (retryCountRef.current < 3) {
        retryCountRef.current++
        setTimeout(fetchCards, 2000 * retryCountRef.current)
        return
      }
      setError(e instanceof Error ? e.message : 'Failed to connect to backend')
      setCards([])
    } finally {
      setLoading(false)
    }
  }, [subjects])

  useEffect(() => {
    retryCountRef.current = 0
    fetchCards()
  }, [fetchCards])

  const totalCards = cards.length
  const activeItem = cards[currentCardIndex]
  const descLong = activeItem ? activeItem.description.length > MAX_DESC_LENGTH : false
  const icon = getIcon(subjects)

  const handleSwipe = (dir: 'left' | 'right') => {
    if (dir === 'right') {
      addXP(50)
      toast('\uD83D\uDD25 +50 XP Earned!', {
        icon: '\uD83D\uDD25',
        duration: 2000,
      })
    }
    setExpanded(false)
    advanceCard(totalCards)
  }

  if (loading) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center justify-center gap-4 mt-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        >
          <Sparkles className="w-8 h-8 text-[#7C5CFC]" />
        </motion.div>
        <p className="text-slate-400 text-sm">Searching for opportunities...</p>
      </div>
    )
  }

  if (error || !activeItem) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center justify-center gap-4 mt-20">
        <p className="text-slate-400 text-sm text-center">{error || 'No opportunities found'}</p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={fetchCards}
          className="flex items-center gap-2 px-4 py-2 bg-[#7C5CFC] hover:bg-[#8D6CFF] rounded-xl text-white text-sm font-bold transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </motion.button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 flex items-start justify-center gap-6 relative">
      <div className="w-full max-w-xl flex flex-col gap-5 relative" style={{ zIndex: 30 }}>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeItem.id}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.7}
            onDrag={(_, info) => setDragX(info.offset.x)}
            onDragEnd={(_, info) => {
              setDragX(0)
              if (info.offset.x > 100) handleSwipe('right')
              else if (info.offset.x < -100) handleSwipe('left')
            }}
            whileDrag={{ scale: 1.02, transition: { duration: 0.1 } }}
            className="relative w-full bg-[#1E1B2E] border border-[#2D2A3E] rounded-3xl p-6 sm:p-8 shadow-2xl cursor-grab active:cursor-grabbing origin-center overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 rounded-3xl flex items-center justify-center z-20 pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.18), rgba(244,63,94,0.06))' }}
              animate={{ opacity: Math.min(Math.abs(dragX), 200) / 200 }}
            >
              <motion.span
                className="text-3xl font-black text-rose-400 drop-shadow-xl"
                animate={{ scale: Math.min(Math.abs(dragX), 120) / 120 }}
              >
                ✕ Skip
              </motion.span>
            </motion.div>

            <motion.div
              className="absolute inset-0 rounded-3xl flex items-center justify-center z-20 pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.18), rgba(52,211,153,0.06))' }}
              animate={{ opacity: Math.min(Math.abs(dragX), 200) / 200 }}
            >
              <motion.span
                className="text-3xl font-black text-emerald-400 drop-shadow-xl"
                animate={{ scale: Math.min(Math.abs(dragX), 120) / 120 }}
              >
                ♥ Apply
              </motion.span>
            </motion.div>

            <motion.div
              variants={staggerVariants}
              initial="hidden"
              animate="visible"
              className="relative z-10"
            >
              <motion.div variants={itemVariants} className="flex items-center justify-between mb-4">
                <span className="inline-block px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md">
                  {icon} {activeItem.tags[0]}
                </span>
                <motion.div
                  className="bg-[#13111C] border border-[#2D2A3E] rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-1.5"
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="w-5 h-5 rounded-full bg-[#7C5CFC]/10 border border-[#7C5CFC]/30 flex items-center justify-center text-[9px] font-bold text-[#7C5CFC]">
                    %
                  </div>
                  <span className="text-xs font-bold text-slate-200">{activeItem.matchPercentage}% Match</span>
                </motion.div>
              </motion.div>

              <motion.h2 variants={itemVariants} className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug text-balance mb-3">
                {activeItem.title}
              </motion.h2>

              <motion.div variants={itemVariants} className="mb-4">
                <p className="text-sm text-slate-400 leading-relaxed text-balance">
                  {descLong && !expanded
                    ? activeItem.description.slice(0, MAX_DESC_LENGTH) + '...'
                    : activeItem.description}
                </p>
                {descLong && (
                  <motion.button
                    whileHover={{ x: 2 }}
                    onClick={() => setExpanded(!expanded)}
                    className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#7C5CFC] hover:text-[#8D6CFF] transition-colors"
                  >
                    {expanded ? (
                      <>Show less <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Read more <ChevronDown className="w-3 h-3" /></>
                    )}
                  </motion.button>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2 mb-4">
                <DetailBadge icon={<Clock className="w-4 h-4" />} label="Deadline" value={activeItem.registrationDeadline} />
                <DetailBadge icon={<DollarSign className="w-4 h-4" />} label="Cost" value={activeItem.cost} />
                <DetailBadge icon={<Users className="w-4 h-4" />} label="Eligibility" value={activeItem.eligibility} />
                <DetailBadge icon={<Sparkles className="w-4 h-4" />} label="Skills" value={activeItem.skills} />
              </motion.div>

              <motion.div variants={itemVariants} className="flex flex-wrap gap-2 mb-4 border-t border-b border-white/5 py-4">
                <div className="flex items-center gap-1.5 bg-[#0D0B18] border border-[#2D2A3E]/50 px-3 py-1.5 rounded-xl text-xs text-slate-300">
                  <Briefcase className="w-3.5 h-3.5 text-[#7C5CFC]" />
                  <span>{activeItem.organization}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#0D0B18] border border-[#2D2A3E]/50 px-3 py-1.5 rounded-xl text-xs text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>{activeItem.location}</span>
                </div>
                {activeItem.applyUrl && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openExternal(activeItem.applyUrl)}
                    className="flex items-center gap-1.5 bg-[#0D0B18] border border-[#2D2A3E]/50 px-3 py-1.5 rounded-xl text-xs text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/30 transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[100px]">Source link</span>
                  </motion.button>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="flex flex-wrap gap-1.5 mb-5">
                {activeItem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </motion.div>

              <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Card {currentCardIndex + 1} of {totalCards}</span>
                  <span className="text-xs text-slate-500">{activeItem.matchPercentage}% Match</span>
                </div>
                <div className="w-full h-1.5 bg-[#0D0B18] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#7C5CFC] to-[#6D4FF2] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${activeItem.matchPercentage}%` }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 mt-5 relative z-30">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSwipe('left')}
                  className="flex items-center justify-center gap-2 py-3 bg-[#0D0B18] hover:bg-rose-950/20 border border-[#2D2A3E] hover:border-rose-900/30 rounded-xl text-slate-400 hover:text-rose-400 text-sm font-bold transition-all duration-150"
                >
                  <X className="w-4 h-4" />
                  <span>Skip</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSwipe('right')}
                  className="flex items-center justify-center gap-2 py-3 bg-[#7C5CFC] hover:bg-[#8D6CFF] rounded-xl text-white text-sm font-bold transition-all duration-150 shadow-lg shadow-[#7C5CFC]/20"
                >
                  <Heart className="w-4 h-4 fill-current" />
                  <span>Apply</span>
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="hidden lg:flex flex-col items-center gap-3 mt-8 sticky top-8">
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        >
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#2D2A3E" strokeWidth="4" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              stroke="url(#discoverProgress)"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ strokeDasharray: '0 264' }}
              animate={{ strokeDasharray: `${2 * Math.PI * 42 * activeItem.matchPercentage / 100} ${2 * Math.PI * 42 * (1 - activeItem.matchPercentage / 100)}` }}
              transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
            />
            <defs>
              <linearGradient id="discoverProgress" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7C5CFC" />
                <stop offset="100%" stopColor="#6D4FF2" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {userData.photoURL ? (
              <img
                src={userData.photoURL}
                alt=""
                className="w-16 h-16 rounded-full object-cover border-2 border-[#7C5CFC]/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-lg font-bold text-white">
                {userData.displayName[0]}
              </div>
            )}
          </div>
        </motion.div>
        <motion.div
          className="text-center flex flex-col gap-0.5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <span className="text-sm font-bold text-white">{userData.displayName}</span>
          <span className="text-xs font-semibold text-[#7C5CFC]">{activeItem.matchPercentage}% Match</span>
        </motion.div>
      </div>
    </div>
  )
}
