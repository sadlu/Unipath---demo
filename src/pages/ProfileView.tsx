import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { motion } from 'framer-motion'
import { Award, BookOpen, Trophy, ScrollText, Mail, Lock } from 'lucide-react'

const ACHIEVEMENTS = [
  {
    id: 'Scholar', title: 'Scholar',
    subtitle: 'Scholar a scholar achievement most favored achievement conditions.',
    icon: BookOpen, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
  },
  {
    id: 'First Save', title: 'First Save',
    subtitle: 'First save acounte new entry and learning assessment words.',
    icon: Award, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
  },
  {
    id: 'First Discovery', title: 'First Discovery',
    subtitle: 'First discovery. Achievement conditions are saved windows.',
    icon: Trophy, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20',
  },
  {
    id: 'Explorer', title: 'Explorer',
    subtitle: 'Explorer. Appcalitte achievments the best need itsas engineening.',
    icon: ScrollText, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20',
  },
]

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    setRotateX(-y * 8)
    setRotateY(x * 8)
  }

  function handleLeave() { setRotateX(0); setRotateY(0) }

  return (
    <div ref={ref} onMouseMove={handleMouse} onMouseLeave={handleLeave} className="perspective-card">
      <motion.div
        className={className}
        animate={{ rotateX, rotateY }}
        transition={{ type: 'spring', stiffness: 150, damping: 15 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {children}
      </motion.div>
    </div>
  )
}

export default function ProfileView() {
  const isMobile = useIsMobile()
  const userData = useStore((s) => s.userData)
  const xp = userData.xp
  const level = userData.level
  const achievements = userData.achievements

  return (
    <motion.div
      className={`w-full ${isMobile ? '' : 'max-w-2xl mx-auto px-5'} flex flex-col gap-5 md:gap-6 pb-8`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ staggerChildren: 0.08 }}
    >
      {isMobile ? (
        <>
          <div className="w-full px-4 py-8 flex flex-col items-center gap-3 border-b border-[#00F0FF]/10">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#7C5CFC] flex items-center justify-center text-2xl font-black text-white overflow-hidden shadow-xl shadow-[#00F0FF]/30">
              {(userData as any).photoURL ? (
                <img src={(userData as any).photoURL} className="w-full h-full object-cover" alt="" />
              ) : userData.displayName[0]}
            </div>
            <h2 className="text-xl font-extrabold text-white">{userData.displayName}</h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Mail className="w-3.5 h-3.5" /><span>{userData.email}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-bold text-[#00F0FF]">Lv {level}</span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="text-slate-300">{xp} XP</span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="text-slate-400">{achievements.length}/{ACHIEVEMENTS.length} achievements</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 px-4 py-2">
              <Trophy className="w-4 h-4 text-[#00F0FF]" />
              <span className="text-xs font-bold text-[#00F0FF] uppercase tracking-wider">Achievements</span>
            </div>
            {ACHIEVEMENTS.map((a) => {
              const Icon = a.icon
              const unlocked = achievements.includes(a.id)
              return (
                <div key={a.id} className="flex items-center justify-between px-4 py-4 border-b border-[#00F0FF]/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${unlocked ? a.bg : 'bg-slate-800/50'} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${unlocked ? a.color : 'text-slate-600'}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{a.title}</h4>
                      <p className="text-xs text-slate-400">{a.subtitle}</p>
                    </div>
                  </div>
                  {unlocked ? (
                    <span className="text-[10px] font-bold text-emerald-400">Unlocked</span>
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <TiltCard>
            <div className="w-full holo-glass-strong rounded-2xl p-5 md:p-6 flex flex-col gap-4 neon-glow-purple">
              <div className="flex items-center gap-4 md:gap-5">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#7C5CFC] flex items-center justify-center text-xl md:text-2xl font-black text-white shrink-0 overflow-hidden shadow-lg shadow-[#00F0FF]/30">
                  {(userData as any).photoURL ? (
                    <img src={(userData as any).photoURL} className="w-full h-full object-cover" alt="" />
                  ) : userData.displayName[0]}
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <h2 className="text-lg md:text-xl font-extrabold text-white truncate">{userData.displayName}</h2>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Mail className="w-3 h-3" /><span className="truncate">{userData.email}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#00F0FF]">Lv {level} &bull; {xp} XP</span>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">{achievements.length}/{ACHIEVEMENTS.length}</span>
                      <span className="text-[11px] text-slate-500">Achievements</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TiltCard>

          <div className="flex flex-col gap-3">
            <h3 className="text-base font-bold text-white">Achievements</h3>
            <div className="grid grid-cols-2 gap-3">
              {ACHIEVEMENTS.map((a) => {
                const Icon = a.icon
                const unlocked = achievements.includes(a.id)
                return (
                  <TiltCard key={a.id}>
                    <div className={`rounded-xl p-4 flex flex-col gap-2 border relative overflow-hidden ${unlocked ? 'holo-glass' : 'holo-glass opacity-60'}`}>
                      {!unlocked && (
                        <motion.div
                          className="absolute -inset-4 rounded-full border-2 border-dashed border-[#00F0FF]/20"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                          style={{ width: '150%', height: '150%', left: '-25%', top: '-25%' }}
                        />
                      )}
                      <div className={`w-9 h-9 rounded-lg ${unlocked ? a.bg : 'bg-slate-800/50'} border ${unlocked ? 'border-[#00F0FF]/30' : 'border-slate-700/30'} flex items-center justify-center relative z-10`}>
                        <Icon className={`w-4 h-4 ${unlocked ? a.color : 'text-slate-600'}`} />
                      </div>
                      <h4 className="text-sm font-bold text-white relative z-10">{a.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed text-balance line-clamp-2 relative z-10">{a.subtitle}</p>
                      {unlocked ? (
                        <motion.span
                          className="text-[10px] font-bold text-emerald-400 relative z-10"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        >
                          ✓ Unlocked
                        </motion.span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-600 flex items-center gap-1 relative z-10">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </div>
                  </TiltCard>
                )
              })}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
