import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { motion } from 'framer-motion'
import { Home, Sparkles, Users, MessageCircle, User, Settings, GraduationCap } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'discover', icon: Sparkles, label: 'Discover' },
  { id: 'cv-coach', icon: GraduationCap, label: 'Coach' },
  { id: 'people', icon: Users, label: 'People' },
  { id: 'chat', icon: MessageCircle, label: 'Chat' },
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function BottomDock() {
  const isMobile = useIsMobile()
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)

  const active = (id: string) => view === id || (id === 'chat' && view === 'chat')

  if (isMobile) {
    return (
      <div className="w-full fixed bottom-0 left-0 right-0 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="w-full px-2 py-1.5 flex items-center justify-around overflow-x-auto" style={{ background: 'rgba(19, 17, 28, 0.92)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = active(item.id)
            const Icon = item.icon
            return (
              <motion.button
                key={item.id}
                onClick={() => setView(item.id)}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] rounded-xl px-2 shrink-0"
                whileTap={{ scale: 0.85 }}
                animate={isActive ? { y: [0, -6, 0] } : { y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Icon
                  className={`transition-all duration-200 ${
                    isActive
                      ? 'w-5 h-5 text-[#7C5CFC] drop-shadow-[0_0_8px_rgba(124,92,252,0.5)]'
                      : 'w-5 h-5 text-slate-500'
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span className={`text-[9px] font-semibold leading-none ${
                  isActive ? 'text-[#7C5CFC]' : 'text-slate-500'
                }`}>
                  {item.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex justify-center pb-4 px-4 z-20 pointer-events-none">
      <div className="glass rounded-2xl py-2 px-2 flex items-center gap-0.5 pointer-events-auto shadow-2xl">
        {NAV_ITEMS.map((item) => {
          const isActive = active(item.id)
          const Icon = item.icon
          return (
            <motion.button
              key={item.id}
              onClick={() => setView(item.id)}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl"
              whileTap={{ scale: 0.85 }}
              animate={isActive ? { y: [0, -4, 0] } : { y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-bg"
                  className="absolute inset-0 rounded-xl bg-white/8 border border-white/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`relative z-10 w-5 h-5 transition-all duration-200 ${
                  isActive
                    ? 'text-[#7C5CFC] drop-shadow-[0_0_8px_rgba(124,92,252,0.5)]'
                    : 'text-slate-500'
                }`}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              {isActive && (
                <motion.div
                  layoutId="nav-dot"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#7C5CFC]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
