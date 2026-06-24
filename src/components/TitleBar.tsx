import { useState } from 'react'
import { useStore } from '../store/useStore'
import { X, Minus, Square, Flame } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import AnimatedNumber from './AnimatedNumber'

const api = () => window.electronAPI

export default function TitleBar() {
  const userData = useStore((s) => s.userData)
  const [clickCount, setClickCount] = useState(0)
  const [showEgg, setShowEgg] = useState(false)

  function handleUnipathClick() {
    const next = clickCount + 1
    setClickCount(next)
    if (next >= 5) {
      setClickCount(0)
      setShowEgg(true)
      setTimeout(() => setShowEgg(false), 4000)
    }
  }

  return (
    <header className="titlebar-drag w-full flex justify-center pt-3 px-4 z-50 absolute top-0 left-0 right-0 pointer-events-none">
      <div className="glass rounded-2xl px-4 py-2.5 flex items-center justify-between w-full max-w-2xl pointer-events-auto titlebar-no-drag shadow-2xl">
        <motion.button
          onClick={handleUnipathClick}
          className="text-sm font-extrabold tracking-tight"
          whileTap={{ scale: 0.9 }}
        >
          <span className="bg-gradient-to-r from-[#7C5CFC] via-[#F59E0B] to-[#7C5CFC] bg-clip-text text-transparent bg-[length:200%_100%] animate-pulse" style={{ backgroundSize: '200% 100%', animation: 'shimmer 3s linear infinite' }}>
            unipath
          </span>
        </motion.button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-xs font-bold text-amber-400">{userData.streakDays}</span>
          </div>
          <span className="text-[11px] font-bold text-slate-500 tracking-wide hidden sm:block">Lv {userData.level}</span>
          <div className="h-4 w-px bg-white/5 hidden sm:block" />
          <span className="text-[11px] font-semibold text-slate-400 hidden sm:block"><AnimatedNumber value={userData.xp} /> XP</span>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-[10px] font-bold text-white ml-1 shadow-lg shadow-[#7C5CFC]/30">
            {userData.displayName?.[0] || '?'}
          </div>
        </div>

        <div className="flex items-center gap-0.5 ml-2">
          <button onClick={() => api()?.minimize()} className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors active:scale-90"><Minus className="w-3.5 h-3.5" /></button>
          <button onClick={() => api()?.maximize()} className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors active:scale-90"><Square className="w-3 h-3" /></button>
          <button onClick={() => api()?.close()} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors active:scale-90"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <AnimatePresence>
        {showEgg && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 glass rounded-2xl px-6 py-3 shadow-2xl border border-[#7C5CFC]/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#7C5CFC] flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-sm font-semibold text-white">Did you know this app was developed by <span className="text-[#F59E0B]">Fouad</span>, <span className="text-[#7C5CFC]">Sachin</span> and <span className="text-[#7C5CFC]">AJ</span></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
