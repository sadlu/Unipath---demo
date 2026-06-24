import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Flame } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function MobileHeader() {
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
    <header
      className="w-full z-50 absolute top-0 left-0 right-0 pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between px-4 py-1.5 pointer-events-auto">
        <motion.button onClick={handleUnipathClick} whileTap={{ scale: 0.9 }}>
          <span className="text-sm font-extrabold bg-gradient-to-r from-[#7C5CFC] via-[#F59E0B] to-[#7C5CFC] bg-clip-text text-transparent">
            unipath
          </span>
        </motion.button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[11px] font-bold text-amber-400">{userData.streakDays}</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-[#7C5CFC]/30">
            {userData.displayName?.[0] || '?'}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showEgg && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mx-4 p-3 glass rounded-2xl shadow-2xl border border-[#7C5CFC]/30"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#7C5CFC] flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-xs font-semibold text-white">Developed by <span className="text-[#F59E0B]">Fouad</span>, <span className="text-[#7C5CFC]">Sachin</span> and <span className="text-[#7C5CFC]">AJ</span></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
