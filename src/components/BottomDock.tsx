import { useStore } from '../store/useStore'
import { motion } from 'framer-motion'
import { Home, Sparkles, Users, MessageCircle, User, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'home', icon: Home },
  { id: 'discover', icon: Sparkles },
  { id: 'people', icon: Users },
  { id: 'chat', icon: MessageCircle },
  { id: 'profile', icon: User },
  { id: 'settings', icon: Settings },
]

export default function BottomDock() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)

  return (
    <div className="w-full flex justify-center pb-4 px-4 z-20 pointer-events-none">
      <div className="glass rounded-2xl py-2 px-2 flex items-center gap-0.5 pointer-events-auto shadow-2xl">
        {NAV_ITEMS.map((item) => {
          const active = view === item.id || (item.id === 'chat' && view === 'chat')
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
            >
              {active && (
                <motion.div
                  layoutId="nav-bg"
                  className="absolute inset-0 rounded-xl bg-white/8 border border-white/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`relative z-10 w-4.5 h-4.5 transition-all duration-200 ${
                  active
                    ? 'text-[#7C5CFC] drop-shadow-[0_0_8px_rgba(124,92,252,0.5)]'
                    : 'text-slate-500'
                }`}
                strokeWidth={active ? 2.5 : 1.5}
              />
              {active && (
                <motion.div
                  layoutId="nav-dot"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#7C5CFC]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
