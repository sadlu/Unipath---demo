import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { LogIn, UserPlus, User, Eye, EyeOff, Wifi, WifiOff, RefreshCw, Sparkles, Loader2 } from 'lucide-react'
import { useServerStatus } from '../hooks/useServerStatus'
import { motion, AnimatePresence } from 'framer-motion'
import { sounds } from '../lib/sound'

const ALEVEL_SUBJECTS = [
  'Mathematics', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Computer Science', 'Economics', 'Business Studies', 'Accounting',
  'History', 'Geography', 'Psychology', 'Sociology',
  'English Literature', 'English Language', 'Law', 'Politics', 'Philosophy',
  'Art & Design', 'Music', 'Drama & Theatre',
  'French', 'German', 'Spanish', 'Arabic',
  'Environmental Science', 'Geology', 'Electronics',
  'Design & Technology', 'Physical Education', 'Religious Studies',
  'Media Studies', 'Photography',
]

export default function LoginScreen() {
  const isMobile = useIsMobile()
  const loginServer = useStore((s) => s.loginServer)
  const registerServer = useStore((s) => s.registerServer)
  const continueAsGuest = useStore((s) => s.continueAsGuest)

  const [tab, setTab] = useState<'login' | 'register'>('register')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (error) sounds.error() }, [error])

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    )
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      await loginServer(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password || !displayName.trim()) {
      setError('Please fill in all fields')
      return
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }
    if (selectedSubjects.length === 0) {
      setError('Please select at least one A-Level subject')
      return
    }
    setLoading(true)
    try {
      await registerServer(username.trim(), password, displayName.trim(), selectedSubjects)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
    setLoading(false)
  }

  const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  }

  function handleTabSwitch(t: 'login' | 'register') {
    sounds.tab()
    setTab(t)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    sounds.click()
    if (tab === 'login') await handleLogin(e)
    else await handleRegister(e)
  }

  return (
    <div className="w-full min-h-screen bg-[#13111C] flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(600px circle at 20% 30%, rgba(124,92,252,0.08) 0%, transparent 70%)',
            'radial-gradient(600px circle at 80% 60%, rgba(124,92,252,0.12) 0%, transparent 70%)',
            'radial-gradient(600px circle at 40% 80%, rgba(124,92,252,0.08) 0%, transparent 70%)',
            'radial-gradient(600px circle at 20% 30%, rgba(124,92,252,0.08) 0%, transparent 70%)',
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.div
          className="text-center mb-6 md:mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <motion.h1
            className="text-3xl md:text-4xl font-black text-white tracking-tight"
            whileHover={{ scale: 1.03 }}
          >
            <Sparkles className="inline w-5 h-5 md:w-6 md:h-6 text-[#7C5CFC] mr-1.5 -mt-0.5" />
            UniPath
          </motion.h1>
          <p className="text-slate-400 text-sm mt-2">Your personal opportunity compass</p>
        </motion.div>

        <motion.div
          className="bg-[#1E1B2E]/90 backdrop-blur-xl border border-[#2D2A3E] rounded-2xl p-5 md:p-6 shadow-2xl shadow-[#7C5CFC]/5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        >
          <div className="flex mb-6 bg-[#0D0B18] rounded-xl p-1">
            <motion.button
              onClick={() => handleTabSwitch('login')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 rounded-lg text-sm font-semibold relative ${
                tab === 'login' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              whileTap={{ scale: 0.96 }}
            >
              {tab === 'login' && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-0 bg-[#7C5CFC] rounded-lg shadow-lg shadow-[#7C5CFC]/20"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Login
              </span>
            </motion.button>
            <motion.button
              onClick={() => handleTabSwitch('register')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 rounded-lg text-sm font-semibold relative ${
                tab === 'register' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              whileTap={{ scale: 0.96 }}
            >
              {tab === 'register' && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-0 bg-[#7C5CFC] rounded-lg shadow-lg shadow-[#7C5CFC]/20"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Create Account
              </span>
            </motion.button>
          </div>

          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors focus:shadow-[0_0_20px_-8px_#7C5CFC]"
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <motion.button
                      type="button"
                      onClick={() => { setShowPassword(!showPassword); sounds.click() }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      whileTap={{ scale: 0.85 }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </motion.button>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                      className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors focus:shadow-[0_0_20px_-8px_#7C5CFC]"
                    />
                  </div>
                </motion.div>

                {tab === 'register' && (
                  <>
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="How should we call you?"
                        className="w-full px-4 py-3 md:py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors focus:shadow-[0_0_20px_-8px_#7C5CFC]"
                      />
                    </motion.div>

                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        A-Level Subjects
                      </label>
                      <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 p-2 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl">
                        {ALEVEL_SUBJECTS.map((subject) => {
                          const selected = selectedSubjects.includes(subject)
                          return (
                            <motion.button
                              key={subject}
                              type="button"
                              onClick={() => { toggleSubject(subject); selected ? sounds.toggleOff() : sounds.toggleOn() }}
                              className={`px-3 py-1.5 md:px-2.5 md:py-1 rounded-lg text-xs font-semibold relative ${
                                selected
                                  ? 'text-white'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                              whileTap={{ scale: 0.9 }}
                              layout
                            >
                              {selected && (
                                <motion.span
                                  layoutId={`subject-bg-${subject}`}
                                  className="absolute inset-0 bg-[#7C5CFC] rounded-lg shadow-sm"
                                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                />
                              )}
                              <span className="relative z-10">{subject}</span>
                            </motion.button>
                          )
                        })}
                      </div>
                      <motion.p
                        className="text-[10px] text-slate-600"
                        animate={{ opacity: selectedSubjects.length > 0 ? 1 : 0.5 }}
                      >
                        {selectedSubjects.length > 0
                          ? `${selectedSubjects.length} selected`
                          : 'Select at least one subject'}
                      </motion.p>
                    </motion.div>
                  </>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2.5"
                    >
                      <p className="text-sm text-rose-400 text-center">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 md:py-2.5 bg-gradient-to-r from-[#7C5CFC] to-[#6D4FF2] hover:from-[#8D6CFF] hover:to-[#7C5CFC] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white shadow-lg shadow-[#7C5CFC]/30 flex items-center justify-center gap-2 relative overflow-hidden"
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={!loading ? { scale: 0.97 } : {}}
                  onMouseEnter={() => sounds.click()}
                >
                  {loading ? (
                    <motion.span
                      className="flex items-center gap-2"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {tab === 'login' ? 'Signing in...' : 'Creating account...'}
                    </motion.span>
                  ) : tab === 'login' ? (
                    <><LogIn className="w-4 h-4" /> Login</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Create Account</>
                  )}
                </motion.button>
              </motion.div>
            </AnimatePresence>
          </form>

          <motion.div
            className="mt-4 pt-4 border-t border-[#2D2A3E]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              onClick={() => { sounds.click(); continueAsGuest() }}
              className="w-full py-3 md:py-2.5 bg-[#0D0B18] border border-[#2D2A3E] hover:border-[#7C5CFC]/30 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
            >
              Continue as Guest
            </motion.button>
          </motion.div>
        </motion.div>

        <motion.p
          className="text-center text-xs text-slate-600 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Sign in from any device with the same credentials.
        </motion.p>
      </motion.div>
    </div>
  )
}
