import { useState, useMemo } from 'react'
import { X, Heart, MapPin, Calendar, Briefcase, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useStore } from '../store/useStore'
import { OPPORTUNITIES } from '../data'

function getTimeRemaining(startDate: string): string {
  const now = new Date()
  const start = new Date(startDate)
  const diffMs = start.getTime() - now.getTime()

  if (diffMs < 0) return 'Started already'

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 30) return `Starts in ${Math.floor(diffDays / 30)} months`
  if (diffDays > 1) return `Starts in ${diffDays} days`
  if (diffDays === 1) return 'Starts tomorrow'
  if (diffHours >= 1) return `Starts in ${diffHours} hours`
  if (diffMinutes >= 1) return `Starts in ${diffMinutes} minutes`
  return 'Starting soon'
}

function openExternal(url: string) {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

const MAX_DESC_LENGTH = 120

export default function DiscoverView() {
  const currentCardIndex = useStore((s) => s.currentCardIndex)
  const advanceCard = useStore((s) => s.advanceCard)
  const addXP = useStore((s) => s.addXP)
  const userData = useStore((s) => s.userData)
  const [expanded, setExpanded] = useState(false)

  const totalCards = OPPORTUNITIES.length
  const activeItem = OPPORTUNITIES[currentCardIndex]
  const timeRemaining = useMemo(() => getTimeRemaining(activeItem.startDate), [activeItem.startDate])
  const descLong = activeItem.description.length > MAX_DESC_LENGTH

  const handleSwipe = (dir: 'left' | 'right') => {
    if (dir === 'right') {
      addXP(50)
      toast('\uD83D\uDD25 +50 XP Earned!', {
        icon: '\uD83D\uDD25',
        duration: 2000,
      })
    } else {
      console.log('[Skip] Advanced to next card')
    }
    setExpanded(false)
    advanceCard(totalCards)
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 flex items-start justify-center gap-6 relative">
      <div className="w-full max-w-xl flex flex-col gap-5 relative" style={{ zIndex: 30 }}>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeItem.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.9}
            onDragEnd={(_, info) => {
              if (info.offset.x > 100) handleSwipe('right')
              else if (info.offset.x < -100) handleSwipe('left')
            }}
            whileDrag={{
              rotate: 0,
              scale: 1.02,
            }}
            className="relative w-full bg-[#1E1B2E] border border-[#2D2A3E] rounded-3xl p-6 sm:p-8 shadow-2xl cursor-grab active:cursor-grabbing origin-center"
          >
            <div
              className="absolute inset-0 rounded-3xl flex items-center justify-center bg-rose-600/20 backdrop-blur-[2px] z-20 pointer-events-none"
              style={{ opacity: 0 }}
              data-side="left"
            >
              <span className="text-3xl font-black text-rose-400 drop-shadow-lg">✕ Skip</span>
            </div>

            <div
              className="absolute inset-0 rounded-3xl flex items-center justify-center bg-emerald-600/20 backdrop-blur-[2px] z-20 pointer-events-none"
              style={{ opacity: 0 }}
              data-side="right"
            >
              <span className="text-3xl font-black text-emerald-400 drop-shadow-lg">♥ Apply</span>
            </div>

            <div className="absolute -top-4 right-4 bg-[#13111C] border border-[#2D2A3E] rounded-xl px-3 py-2 shadow-xl flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#7C5CFC]/10 border border-[#7C5CFC]/30 flex items-center justify-center text-[10px] font-bold text-[#7C5CFC]">
                %
              </div>
              <span className="text-xs font-bold text-slate-200">{activeItem.matchPercentage}% Match</span>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="inline-block px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md">
                {activeItem.imageIcon} {activeItem.tags[0]}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                <Calendar className="w-3 h-3" />
                {timeRemaining}
              </span>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug text-balance">
                {activeItem.title}
              </h2>
              <div>
                <p className="text-sm text-slate-400 leading-relaxed text-balance">
                  {descLong && !expanded
                    ? activeItem.description.slice(0, MAX_DESC_LENGTH) + '...'
                    : activeItem.description}
                </p>
                {descLong && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#7C5CFC] hover:text-[#8D6CFF] transition-colors"
                  >
                    {expanded ? (
                      <>Show less <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Read more <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 border-t border-b border-white/5 py-4">
              <div className="flex items-center gap-1.5 bg-[#0D0B18] border border-[#2D2A3E]/50 px-3 py-1.5 rounded-xl text-xs text-slate-300">
                <Briefcase className="w-3.5 h-3.5 text-[#7C5CFC]" />
                <span>{activeItem.organization}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#0D0B18] border border-[#2D2A3E]/50 px-3 py-1.5 rounded-xl text-xs text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>{activeItem.location}</span>
              </div>
              <button
                onClick={() =>
                  openExternal(
                    `https://www.google.com/maps?q=${activeItem.coordinates.lat},${activeItem.coordinates.lng}`
                  )
                }
                className="flex items-center gap-1.5 bg-[#0D0B18] border border-[#2D2A3E]/50 px-3 py-1.5 rounded-xl text-xs text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/30 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>View on Map</span>
              </button>
              <button
                onClick={() => openExternal(activeItem.applyUrl)}
                className="flex items-center gap-1.5 bg-[#0D0B18] border border-[#2D2A3E]/50 px-3 py-1.5 rounded-xl text-xs text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/30 transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span className="truncate max-w-[100px]">Apply link</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {activeItem.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">Card {currentCardIndex + 1} of {totalCards}</span>
              <span className="text-xs text-slate-500">{activeItem.matchPercentage}% Match</span>
            </div>
            <div className="w-full h-1.5 bg-[#0D0B18] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#7C5CFC] to-[#6D4FF2] rounded-full transition-all duration-300"
                style={{ width: `${activeItem.matchPercentage}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5 relative z-30">
              <button
                onClick={() => handleSwipe('left')}
                className="flex items-center justify-center gap-2 py-3 bg-[#0D0B18] hover:bg-rose-950/20 border border-[#2D2A3E] hover:border-rose-900/30 rounded-xl text-slate-400 hover:text-rose-400 text-sm font-bold transition-all duration-150"
              >
                <X className="w-4 h-4" />
                <span>Skip</span>
              </button>
              <button
                onClick={() => handleSwipe('right')}
                className="flex items-center justify-center gap-2 py-3 bg-[#7C5CFC] hover:bg-[#8D6CFF] rounded-xl text-white text-sm font-bold transition-all duration-150 shadow-lg shadow-[#7C5CFC]/20"
              >
                <Heart className="w-4 h-4 fill-current" />
                <span>Apply</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="hidden lg:flex flex-col items-center gap-3 mt-8 sticky top-8">
        <div className="relative">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#2D2A3E" strokeWidth="4" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="url(#discoverProgress)"
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 42 * activeItem.matchPercentage / 100} ${2 * Math.PI * 42 * (1 - activeItem.matchPercentage / 100)}`}
              strokeLinecap="round"
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
        </div>
        <div className="text-center flex flex-col gap-0.5">
          <span className="text-sm font-bold text-white">{userData.displayName}</span>
          <span className="text-xs font-semibold text-[#7C5CFC]">{activeItem.matchPercentage}% Match</span>
        </div>
      </div>
    </div>
  )
}
