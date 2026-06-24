import React from 'react'
import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function AchievementModal() {
  const achievementModal = useStore((s) => s.achievementModal)
  const dismissAchievement = useStore((s) => s.dismissAchievement)

  return (
    <AnimatePresence>
      {achievementModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-sm bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl"
          >
            <span className="text-5xl">🎉</span>
            <h2 className="text-lg font-extrabold text-white">Achievement Unlocked!</h2>
            <p className="text-sm text-slate-400 text-center text-balance">
              You earned the <span className="font-bold text-[#7C5CFC]">{achievementModal}</span> achievement.
            </p>
            <button
              onClick={dismissAchievement}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#7C5CFC] hover:bg-[#8D6CFF] rounded-xl text-white text-sm font-bold transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Awesome!</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
