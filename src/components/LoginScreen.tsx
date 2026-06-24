import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { LogIn, UserPlus, User, Eye, EyeOff, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useServerStatus } from '../hooks/useServerStatus'

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

  return (
    <div className="w-full min-h-screen bg-[#13111C] flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">UniPath</h1>
          <p className="text-slate-400 text-sm mt-2">Your personal opportunity compass</p>
        </div>

        <div className="bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-5 md:p-6 shadow-2xl">
          <div className="flex mb-6 bg-[#0D0B18] rounded-xl p-1">
            <button
              onClick={() => { setTab('login'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === 'login'
                  ? 'bg-[#7C5CFC] text-white shadow-lg shadow-[#7C5CFC]/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
            <button
              onClick={() => { setTab('register'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === 'register'
                  ? 'bg-[#7C5CFC] text-white shadow-lg shadow-[#7C5CFC]/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Create Account
            </button>
          </div>

          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
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
                  className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
                />
              </div>
            </div>

            {tab === 'register' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How should we call you?"
                    className="w-full px-4 py-3 md:py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    A-Level Subjects
                  </label>
                  <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 p-2 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl">
                    {ALEVEL_SUBJECTS.map((subject) => {
                      const selected = selectedSubjects.includes(subject)
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => toggleSubject(subject)}
                          className={`px-3 py-1.5 md:px-2.5 md:py-1 rounded-lg text-xs font-semibold transition-all ${
                            selected
                              ? 'bg-[#7C5CFC] text-white shadow-sm'
                              : 'bg-[#1E1B2E] text-slate-400 hover:text-slate-200 hover:bg-[#2D2A3E]'
                          }`}
                        >
                          {subject}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-slate-600">
                    {selectedSubjects.length > 0
                      ? `${selectedSubjects.length} selected`
                      : 'Select at least one subject'}
                  </p>
                </div>
              </>
            )}

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2.5">
                <p className="text-sm text-rose-400 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 md:py-2.5 bg-[#7C5CFC] hover:bg-[#8D6CFF] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-colors shadow-lg shadow-[#7C5CFC]/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">
                  {tab === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : tab === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Login
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-[#2D2A3E]">
            <button
              onClick={continueAsGuest}
              className="w-full py-3 md:py-2.5 bg-[#0D0B18] border border-[#2D2A3E] hover:border-slate-500/30 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Continue as Guest
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Sign in from any device with the same credentials.
        </p>
      </div>
    </div>
  )
}
