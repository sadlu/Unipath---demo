import { useState } from 'react'
import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Sparkles, Users, MessageCircle, User, Settings,
  ChevronRight, ChevronLeft, GraduationCap, X
} from 'lucide-react'

const STEPS = [
  {
    icon: GraduationCap,
    title: 'Welcome to UniPath!',
    subtitle: 'Your personal opportunity compass',
    description:
      'Discover scholarships, internships, workshops, and events tailored to your A-Level subjects — all in one place.',
    color: 'from-[#7C5CFC] to-purple-600',
  },
  {
    icon: Home,
    title: 'Home',
    subtitle: 'Your dashboard',
    description:
      'Track your XP and level, see your daily streak, and browse Today\'s Picks — opportunities handpicked just for you based on your subjects.',
    color: 'from-[#7C5CFC] to-[#6EE7B7]',
  },
  {
    icon: Sparkles,
    title: 'Discover',
    subtitle: 'Find opportunities',
    description:
      'Search for volunteering, workshops, competitions, scholarships, internships, and conferences across Nepal. Filter by what matters to you.',
    color: 'from-[#6EE7B7] to-emerald-500',
  },
  {
    icon: Users,
    title: 'People',
    subtitle: 'Connect with peers',
    description:
      'Find and message other students who share your interests. Build your network and collaborate on opportunities.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: MessageCircle,
    title: 'Chat',
    subtitle: 'Real-time messaging',
    description:
      'Chat with other students, share opportunities, and get AI-powered answers to your questions about programs and applications.',
    color: 'from-[#7C5CFC] to-pink-500',
  },
  {
    icon: User,
    title: 'Profile',
    subtitle: 'Your stats & achievements',
    description:
      'View your XP, level, streak, and earned achievements. See your matched opportunities and track your progress over time.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Settings,
    title: 'Settings',
    subtitle: 'Customize your experience',
    description:
      'Adjust theme, accent color, language, notification preferences, and manage your account or reset your data.',
    color: 'from-slate-500 to-slate-700',
  },
]

export default function TutorialOverlay() {
  const [step, setStep] = useState(0)
  const setHasSeenTutorial = useStore((s) => s.setHasSeenTutorial)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const Icon = current.icon

  function handleNext() {
    if (isLast) {
      setHasSeenTutorial()
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleSkip() {
    setHasSeenTutorial()
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="w-full max-w-sm mx-4 glass-card-strong rounded-3xl p-6 shadow-2xl"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="flex justify-between items-start mb-6">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${current.color} flex items-center justify-center shadow-lg`}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {step + 1} / {STEPS.length}
            </span>
          </div>

          <h2 className="text-xl font-display font-bold text-white mb-1">
            {current.title}
          </h2>
          <p className="text-xs font-semibold text-[#7C5CFC] uppercase tracking-wider mb-3">
            {current.subtitle}
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            {current.description}
          </p>

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'bg-[#7C5CFC] w-3'
                      : i < step
                      ? 'bg-[#7C5CFC]/40'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isLast && (
                <button
                  onClick={handleSkip}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Skip
                </button>
              )}
              <button
                onClick={handleNext}
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all bg-gradient-to-r ${current.color} shadow-lg`}
              >
                {isLast ? 'Got it!' : 'Next'}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
