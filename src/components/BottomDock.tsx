import React from 'react'
import { useStore } from '../store/useStore'
import { motion } from 'framer-motion'

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '\u{1F3E0}' },
  { id: 'discover', label: 'Discover', icon: '\u2728' },
  { id: 'people', label: 'People', icon: '\u{1F465}' },
  { id: 'chat', label: 'Chat', icon: '\u{1F4AC}' },
  { id: 'profile', label: 'Profile', icon: '\u{1F464}' },
  { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F' },
]

export default function BottomDock() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)

  return (
    <div className="w-full flex justify-center pb-5 px-4 z-20 pointer-events-none">
      <div className="glass border border-white/10 rounded-full py-2 px-3 shadow-2xl flex items-center gap-1 pointer-events-auto">
        {NAV_ITEMS.map((item) => {
          const active = view === item.id || (item.id === 'chat' && view === 'chat')
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200"
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-white/10 border border-white/10 rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 text-base leading-none">{item.icon}</span>
              <span
                className={`relative z-10 text-xs font-semibold tracking-wide transition-colors duration-200 ${
                  active ? 'text-white' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
