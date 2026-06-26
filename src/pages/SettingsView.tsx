import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  User, Palette, Bell, Shield, Settings2,
  LogOut, ChevronRight, Trash2, Info,
  Sun, Moon, Monitor, Volume2, Check, Mail, BadgeCheck, Key, AlertTriangle,
  Camera, Pencil, Lock, Globe, Wifi, WifiOff, RefreshCw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { registerEmail, verifyEmail, getProfile, uploadAvatar, updateProfile, getApiBase, getStoredToken, authChangePassword } from '../services/api'
import * as localAuth from '../localAuth'

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [rx, setRx] = useState(0)
  const [ry, setRy] = useState(0)
  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setRx(-((e.clientY - r.top) / r.height - 0.5) * 6)
    setRy(((e.clientX - r.left) / r.width - 0.5) * 6)
  }
  function handleLeave() { setRx(0); setRy(0) }
  return (
    <div ref={ref} onMouseMove={handleMouse} onMouseLeave={handleLeave} className="perspective-card">
      <motion.div className={className} animate={{ rotateX: rx, rotateY: ry }} transition={{ type: 'spring', stiffness: 150, damping: 15 }} style={{ transformStyle: 'preserve-3d' }}>
        {children}
      </motion.div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
        checked ? 'bg-[#7C5CFC]' : 'bg-[#2D2A3E]'
      }`}
    >
      <motion.div
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  )
}

function SectionHeader({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="w-4 h-4 text-[#00F0FF]" />
      <h3 className="text-sm font-bold text-white">{label}</h3>
    </div>
  )
}

const ACCENT_COLORS = [
  { name: 'Purple', color: '#7C5CFC' },
  { name: 'Blue', color: '#007AFF' },
  { name: 'Green', color: '#34C759' },
  { name: 'Orange', color: '#FF9500' },
  { name: 'Rose', color: '#FF3B30' },
]

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
]

function MobileSheet({
  show, onClose, title, children
}: {
  show: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-lg holo-glass-strong rounded-t-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-white">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DialogModal({
  show, onClose, title, children
}: {
  show: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm holo-glass-strong rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-white mb-4">{title}</h3>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function SettingsView() {
  const isMobile = useIsMobile()
  const userData = useStore((s) => s.userData)
  const preferences = useStore((s) => s.preferences)
  const authMethod = useStore((s) => s.authMethod)
  const toggleSetting = useStore((s) => s.toggleSetting)
  const setSetting = useStore((s) => s.setSetting)
  const setEmail = useStore((s) => s.setEmail)
  const setTheme = useStore((s) => s.setTheme)
  const setAccentColor = useStore((s) => s.setAccentColor)
  const setLanguage = useStore((s) => s.setLanguage)
  const logout = useStore((s) => s.logout)
  const resetAllProgress = useStore((s) => s.resetAllProgress)

  const settings = userData.settings
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [verifCode, setVerifCode] = useState('')
  const [verifSending, setVerifSending] = useState(false)
  const [verifCodeSent, setVerifCodeSent] = useState(false)
  const [localEmail, setLocalEmail] = useState(userData.email)
  const [backendVerified, setBackendVerified] = useState(false)

  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName] = useState(userData.displayName)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const [serverTesting, setServerTesting] = useState(false)
  const [serverStatus, setServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown')
  const [showServerUrlEdit, setShowServerUrlEdit] = useState(false)
  const [editServerUrl, setEditServerUrl] = useState('')
  const serverUrl = getApiBase()

  useEffect(() => {
    getProfile(userData.uid).then(p => {
      if (p) setBackendVerified(Boolean(p.email_verified))
    }).catch(() => {})
  }, [userData.uid])

  useEffect(() => { checkServerHealth() }, [])

  async function checkServerHealth() {
    setServerTesting(true)
    try {
      const res = await fetch(`${serverUrl}/api/health`, { signal: AbortSignal.timeout(5000) })
      setServerStatus(res.ok ? 'online' : 'offline')
    } catch {
      setServerStatus('offline')
    }
    setServerTesting(false)
  }

  function handleLogout() {
    logout()
    toast('Logged out')
  }

  async function handleClearCache() {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
    localStorage.removeItem('unipath_guest_data')
    toast.success('Cache cleared')
  }

  function handleLangSelect(code: string) {
    setLanguage(code)
    setShowLangPicker(false)
    toast(`Language set to ${LANGUAGES.find(l => l.code === code)?.label}`)
  }

  async function handleSendVerification() {
    if (!localEmail.trim() || !localEmail.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    setVerifSending(true)
    try {
      const result = await registerEmail(userData.uid, localEmail.trim(), userData.displayName)
      if (result.ok) {
        setVerifCodeSent(true)
        setEmail(localEmail.trim())
        toast.success('Verification code sent to your email!')
      } else {
        toast.error(result.error || 'Failed to send verification')
      }
    } catch {
      toast.error('Backend unavailable')
    }
    setVerifSending(false)
  }

  async function handleVerify() {
    if (!verifCode.trim()) {
      toast.error('Enter the verification code')
      return
    }
    try {
      const result = await verifyEmail(localEmail.trim(), verifCode.trim(), userData.uid)
      if (result.ok) {
        toast.success('Email verified!')
        setVerifCodeSent(false)
        setVerifCode('')
      } else {
        toast.error(result.error || 'Invalid code')
      }
    } catch {
      toast.error('Backend unavailable')
    }
  }

  const emailVerified = backendVerified

  function handleNotificationsToggle() {
    toggleSetting('notifications')
  }

  function handleSubToggle(key: 'pushNotifications' | 'emailAlerts' | 'inAppSounds') {
    if (!settings.notifications) {
      toast('Enable notifications first')
      return
    }
    toggleSetting(key)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await uploadAvatar(userData.uid, file)
      if (result.ok && result.url) {
        useStore.setState((s) => ({
          userData: { ...s.userData, photoURL: result.url! },
        }))
        toast.success('Profile picture updated')
      } else {
        toast.error('Upload failed')
      }
    } catch {
      toast.error('Backend unavailable')
    }
  }

  async function handleSaveProfile() {
    if (!editName.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    useStore.setState((s) => ({
      userData: { ...s.userData, displayName: editName.trim() },
    }))
    try {
      await updateProfile(userData.uid, editName.trim())
    } catch {}
    setShowEditProfile(false)
    toast.success('Profile updated')
  }

  function handleChangePassword() {
    if (!newPw || newPw.length < 4) {
      toast.error('Password must be at least 4 characters')
      return
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match')
      return
    }
    if (authMethod === 'server') {
      const token = getStoredToken()
      if (!token) {
        toast.error('Not authenticated')
        return
      }
      authChangePassword(token, curPw, newPw).then((result) => {
        if (result.ok) {
          toast.success('Password changed')
          setShowChangePassword(false)
          setCurPw('')
          setNewPw('')
          setConfirmPw('')
        } else {
          toast.error(result.error || 'Failed to change password')
        }
      }).catch(() => {
        toast.error('Server unreachable')
      })
    } else {
      const username = localAuth.getSessionUsername()
      if (!username) {
        toast.error('No active session')
        return
      }
      localAuth.changePassword(username, curPw, newPw).then(() => {
        toast.success('Password changed')
        setShowChangePassword(false)
        setCurPw('')
        setNewPw('')
        setConfirmPw('')
      }).catch((err) => {
        toast.error(err.message || 'Failed to change password')
      })
    }
  }

  const content = (
    <>
      <div className={`w-full ${isMobile ? '' : 'max-w-2xl mx-auto px-5'} pb-10 mobile-native`}>
        {/* User Header */}
        <TiltCard className={`w-full ${isMobile ? 'px-4 py-6 flex flex-col items-center gap-3' : 'holo-glass-strong rounded-2xl p-5 flex flex-col items-center gap-3 neon-glow-purple'}`}>
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#7C5CFC] flex items-center justify-center text-xl font-black text-white shadow-lg shadow-[#00F0FF]/30 overflow-hidden">
              {(userData as any).photoURL ? (
                <img src={(userData as any).photoURL} className="w-full h-full object-cover" alt="" />
              ) : (
                userData.displayName?.charAt(0) || '?'
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 md:w-6 md:h-6 bg-gradient-to-r from-[#00F0FF] to-[#7C5CFC] rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity shadow-lg">
              <Camera className="w-3.5 h-3.5 md:w-3 md:h-3 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-extrabold text-white">{userData.displayName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{userData.email}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap justify-center">
            <span className="font-semibold text-[#00F0FF]">Lv {userData.level}</span>
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            <span>{userData.xp} XP</span>
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            <span>{authMethod === 'server' ? 'Server Account' : 'Guest'}</span>
          </div>
        </TiltCard>

        <div style={{ height: 24 }} />

        {/* Section A: Profile Management */}
        <div className={`w-full ${isMobile ? 'native-section' : 'holo-glass rounded-2xl p-5'} flex flex-col gap-3`}>
          <SectionHeader icon={User} label="Profile Management" />
          <div className="flex flex-col gap-1">
            <button onClick={() => { setEditName(userData.displayName); setShowEditProfile(true) }} className="flex items-center justify-between px-3 py-4 md:py-3 rounded-xl hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-200">Edit Profile</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
            {authMethod === 'server' && (
              <button onClick={() => setShowChangePassword(true)} className="flex items-center justify-between px-3 py-4 md:py-3 rounded-xl hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-200">Change Password</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            )}
            <div className="flex items-center justify-between px-3 py-4 md:py-3">
              <span className="text-sm text-slate-200">Account Type</span>
              <span className="text-xs font-bold text-[#00F0FF] bg-[#00F0FF]/10 px-2.5 py-1 rounded-full">
                {authMethod === 'server' ? 'Server Account' : 'Guest'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ height: 20 }} />

        {/* Section B: Appearance & Theme */}
        <div className={`w-full ${isMobile ? 'native-section' : 'holo-glass rounded-2xl p-5'} flex flex-col gap-4`}>
          <SectionHeader icon={Palette} label="Appearance & Theme" />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Theme</span>
            <div className="flex gap-2">
              {[
                { value: 'dark' as const, icon: Moon, label: 'Dark' },
                { value: 'light' as const, icon: Sun, label: 'Light' },
                { value: 'system' as const, icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 md:py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    preferences.theme === value
                      ? 'bg-gradient-to-r from-[#00F0FF] to-[#7C5CFC] text-white shadow-lg shadow-[#00F0FF]/20'
                      : 'bg-[#0D0B18] text-slate-400 border border-[#00F0FF]/20 hover:border-[#00F0FF]/30'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accent Color</span>
            <div className="flex gap-3 justify-center py-2">
              {ACCENT_COLORS.map(({ name, color }) => (
                <motion.button
                  key={color}
                  onClick={() => setAccentColor(color)}
                  className="group relative"
                  title={name}
                  whileTap={{ scale: 0.85 }}
                >
                  <div
                    className={`w-10 h-10 md:w-9 md:h-9 rounded-full transition-all ${
                      preferences.accentColor === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1E1B2E] scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                  {preferences.accentColor === color && (
                    <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white" />
                  )}
                  {preferences.accentColor === color && (
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      initial={{ scale: 0, opacity: 0.5 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      style={{ backgroundColor: color }}
                    />
                  )}
                  <motion.span
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                  >
                    {name}
                  </motion.span>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Language</span>
            <div className="relative">
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="w-full flex items-center justify-between px-3 py-3 md:py-2.5 bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl text-sm text-slate-200 hover:border-[#00F0FF]/40 transition-colors"
              >
                <span>{LANGUAGES.find(l => l.code === preferences.language)?.label || 'English'}</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <AnimatePresence>
                {showLangPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute bottom-full mb-1 left-0 right-0 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl overflow-hidden shadow-xl z-10"
                  >
                    {LANGUAGES.map(({ code, label }) => (
                      <button
                        key={code}
                        onClick={() => handleLangSelect(code)}
                        className={`w-full flex items-center justify-between px-3 py-3 md:py-2.5 text-sm transition-colors ${
                          preferences.language === code
                            ? 'text-[#00F0FF] bg-[#00F0FF]/10'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        {label}
                        {preferences.language === code && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div style={{ height: 20 }} />

        {/* Section C: Notifications */}
        <div className={`w-full ${isMobile ? 'native-section' : 'holo-glass rounded-2xl p-5'} flex flex-col gap-4`}>
          <SectionHeader icon={Bell} label="Notifications" />

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Enable Notifications</span>
            <Toggle checked={settings.notifications} onChange={handleNotificationsToggle} />
          </div>

          <div className="flex flex-col gap-3 pl-2 border-l-2 border-[#2D2A3E] ml-1">
            <div className={`flex items-center justify-between ${!settings.notifications ? 'opacity-40' : ''}`}>
              <span className="text-sm text-slate-300">Push Notifications</span>
              <Toggle
                checked={settings.notifications && settings.pushNotifications}
                onChange={() => handleSubToggle('pushNotifications')}
              />
            </div>
            <div className={`flex items-center justify-between ${!settings.notifications ? 'opacity-40' : ''}`}>
              <span className="text-sm text-slate-300">Email Alerts</span>
              <Toggle
                checked={settings.notifications && settings.emailAlerts}
                onChange={() => handleSubToggle('emailAlerts')}
              />
            </div>
            <div className={`flex items-center justify-between ${!settings.notifications ? 'opacity-40' : ''}`}>
              <span className="text-sm text-slate-300">In-App Sounds</span>
              <Toggle
                checked={settings.notifications && settings.inAppSounds}
                onChange={() => handleSubToggle('inAppSounds')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-slate-200">
                <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                Sound Volume
              </span>
              <span className="text-xs font-bold text-[#00F0FF]">{settings.soundVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.soundVolume}
              onChange={(e) => setSetting('soundVolume', Number(e.target.value))}
              className="w-full h-2 bg-[#0D0B18] rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-[#00F0FF] [&::-webkit-slider-thumb]:to-[#7C5CFC]
                [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-[#00F0FF]/40
                [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-r [&::-moz-range-thumb]:from-[#00F0FF] [&::-moz-range-thumb]:to-[#7C5CFC]
                [&::-moz-range-thumb]:border-0"
            />
          </div>
        </div>

        <div style={{ height: 20 }} />

        {/* Section D: Privacy & Security */}
        <div className={`w-full ${isMobile ? 'native-section' : 'holo-glass rounded-2xl p-5'} flex flex-col gap-4`}>
          <SectionHeader icon={Shield} label="Privacy & Security" />

          <div className="flex flex-col gap-2 pb-2 border-b border-white/5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Mail className="w-3 h-3" />
              Email Verification
            </span>
            <div className="flex gap-2">
              <input
                type="email"
                value={localEmail}
                onChange={(e) => setLocalEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 md:py-2.5 bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
              />
              <button
                onClick={handleSendVerification}
                disabled={verifSending}
                className="neon-btn px-5 py-3 md:px-4 md:py-2.5 disabled:opacity-40 rounded-xl text-sm font-semibold text-white shrink-0"
              >
                {verifSending ? '...' : 'Send Code'}
              </button>
            </div>
            {(userData.email && userData.email !== 'guest@unipath.local') && (
              emailVerified ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  <span>Email verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Not verified — check your inbox for the code</span>
                </div>
              )
            )}
            {verifCodeSent && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={verifCode}
                    onChange={(e) => setVerifCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full pl-10 pr-4 py-3 md:py-2 bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
                  />
                </div>
                <button
                  onClick={handleVerify}
                  className="neon-btn px-5 py-3 md:px-4 md:py-2 rounded-xl text-sm font-semibold text-white shrink-0"
                >
                  Verify
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-200">Share analytics to improve UniPath</span>
              <div className="group relative">
                <Info className="w-3.5 h-3.5 text-slate-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl p-3 shadow-xl z-10">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Anonymous usage data helps us improve UniPath. No personally identifiable information is collected.
                  </p>
                </div>
              </div>
            </div>
            <Toggle checked={settings.shareAnalytics} onChange={() => toggleSetting('shareAnalytics')} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Show my online status</span>
            <Toggle checked={settings.onlineStatus} onChange={() => toggleSetting('onlineStatus')} />
          </div>

          <button
            onClick={handleClearCache}
            className="flex items-center justify-between px-3 py-4 md:py-2.5 bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl hover:border-[#00F0FF]/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-200">Clear Cache</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div style={{ height: 20 }} />

        {/* Section E: General */}
        <div className={`w-full ${isMobile ? 'native-section' : 'holo-glass rounded-2xl p-5'} flex flex-col gap-4`}>
          <SectionHeader icon={Settings2} label="General" />

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Auto-save progress</span>
            <Toggle checked={settings.autoSave} onChange={() => toggleSetting('autoSave')} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Desktop Notifications</span>
            <Toggle checked={settings.desktopNotifications} onChange={() => toggleSetting('desktopNotifications')} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Reduce motion</span>
            <Toggle checked={settings.reduceMotion} onChange={() => toggleSetting('reduceMotion')} />
          </div>
        </div>

        <div style={{ height: 20 }} />

        {/* Section F: Server Connection */}
        <div className={`w-full ${isMobile ? 'native-section' : 'holo-glass rounded-2xl p-5 flex flex-col gap-4'}`}>
          <SectionHeader icon={Globe} label="Server Connection" />

          <div className={`flex items-center gap-2 ${isMobile ? 'native-list-row' : 'bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl px-3 py-2'}`}>
            <p className="text-[11px] text-slate-500 font-mono truncate flex-1">{serverUrl}</p>
          </div>

          <div className={`flex items-center justify-between ${isMobile ? 'native-list-row' : ''}`}>
            <div className="flex items-center gap-2">
              {serverTesting ? (
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
              ) : serverStatus === 'online' ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : serverStatus === 'offline' ? (
                <WifiOff className="w-4 h-4 text-rose-400" />
              ) : (
                <Globe className="w-4 h-4 text-slate-500" />
              )}
              <span className={`text-sm font-semibold ${
                serverStatus === 'online' ? 'text-emerald-400' :
                serverStatus === 'offline' ? 'text-rose-400' :
                'text-slate-500'
              }`}>
                {serverTesting ? 'Testing...' :
                 serverStatus === 'online' ? 'Connected' :
                 serverStatus === 'offline' ? 'Cannot reach server' :
                 'Not tested'}
              </span>
            </div>
            <button
              onClick={checkServerHealth}
              disabled={serverTesting}
              className="text-xs font-semibold text-[#00F0FF] hover:text-[#00F0FF]/80 disabled:opacity-40 transition-colors min-h-[36px]"
            >
              Test Connection
            </button>
          </div>
        </div>

        <div style={{ height: 32 }} />

        {/* Logout */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full py-4 md:py-3 holo-glass border border-rose-500/40 hover:border-rose-500 rounded-2xl text-sm font-bold text-rose-400 hover:text-rose-300 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>

        <div style={{ height: 12 }} />

        {/* Reset */}
        <button
          onClick={() => setShowResetConfirm(true)}
          className="w-full py-4 md:py-3 holo-glass rounded-2xl text-xs font-semibold text-slate-500 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
        >
          Reset All Progress
        </button>

        <div style={{ height: 60 }} />
      </div>

      {/* Logout Confirmation Dialog/Bottom Sheet */}
      {isMobile ? (
        <MobileSheet show={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Log Out">
          <p className="text-sm text-slate-400 mb-6">Are you sure you want to log out?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 py-3 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:opacity-90 rounded-xl text-sm font-bold text-white transition-all"
            >
              Log Out
            </button>
          </div>
        </MobileSheet>
      ) : (
        <DialogModal show={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Log Out">
          <p className="text-sm text-slate-400 mb-6">Are you sure you want to log out?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 py-2.5 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 rounded-xl text-sm font-bold text-white transition-colors"
            >
              Log Out
            </button>
          </div>
        </DialogModal>
      )}

      {/* Reset Confirmation */}
      {isMobile ? (
        <MobileSheet show={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Reset All Progress">
          <p className="text-sm text-slate-400 mb-6">
            This will permanently delete all your XP, Level, and Settings. This cannot be undone!
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-3 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowResetConfirm(false); resetAllProgress(); toast('Progress has been wiped') }}
              className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 rounded-xl text-sm font-bold text-white transition-colors"
            >
              Reset
            </button>
          </div>
        </MobileSheet>
      ) : (
        <DialogModal show={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Reset All Progress">
          <p className="text-sm text-slate-400 mb-6">
            This will permanently delete all your XP, Level, and Settings. This cannot be undone!
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-2.5 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowResetConfirm(false); resetAllProgress(); toast('Progress has been wiped') }}
              className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 rounded-xl text-sm font-bold text-white transition-colors"
            >
              Reset
            </button>
          </div>
        </DialogModal>
      )}

      {/* Edit Profile */}
      {isMobile ? (
        <MobileSheet show={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit Profile">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowEditProfile(false)}
              className="flex-1 py-3 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              className="flex-1 py-3 neon-btn rounded-xl text-sm font-bold text-white transition-colors"
            >
              Save
            </button>
          </div>
        </MobileSheet>
      ) : (
        <DialogModal show={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit Profile">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowEditProfile(false)}
              className="flex-1 py-2.5 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              className="flex-1 py-2.5 bg-[#7C5CFC] hover:bg-[#6D4FF2] rounded-xl text-sm font-bold text-white transition-colors"
            >
              Save
            </button>
          </div>
        </DialogModal>
      )}

      {/* Change Password */}
      {isMobile ? (
        <MobileSheet show={showChangePassword} onClose={() => setShowChangePassword(false)} title="Change Password">
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Current Password</label>
              <input
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowChangePassword(false)}
              className="flex-1 py-3 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleChangePassword}
              className="flex-1 py-3 neon-btn rounded-xl text-sm font-bold text-white transition-colors"
            >
              Change
            </button>
          </div>
        </MobileSheet>
      ) : (
        <DialogModal show={showChangePassword} onClose={() => setShowChangePassword(false)} title="Change Password">
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Current Password</label>
              <input
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowChangePassword(false)}
              className="flex-1 py-2.5 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleChangePassword}
              className="flex-1 py-2.5 bg-[#7C5CFC] hover:bg-[#6D4FF2] rounded-xl text-sm font-bold text-white transition-colors"
            >
              Change
            </button>
          </div>
        </DialogModal>
      )}

      {/* Server URL Edit */}
      {isMobile ? (
        <MobileSheet show={showServerUrlEdit} onClose={() => setShowServerUrlEdit(false)} title="Server URL">
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-400">Enter the backend server URL. The app will use this URL for all API requests.</p>
            <input
              type="text"
              value={editServerUrl}
              onChange={(e) => setEditServerUrl(e.target.value)}
              placeholder="https://your-server.com"
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full px-4 py-3 bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl text-sm text-slate-200 font-mono focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
            />
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowServerUrlEdit(false)}
              className="flex-1 py-3 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const url = editServerUrl.trim()
                if (!url) {
                  localStorage.removeItem('unipath_server_url')
                } else {
                  localStorage.setItem('unipath_server_url', url)
                }
                setShowServerUrlEdit(false)
                window.location.reload()
              }}
              className="flex-1 py-3 neon-btn rounded-xl text-sm font-bold text-white transition-colors"
            >
              Save & Reload
            </button>
          </div>
        </MobileSheet>
      ) : (
        <DialogModal show={showServerUrlEdit} onClose={() => setShowServerUrlEdit(false)} title="Server URL">
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-400">Enter the backend server URL. The app will use this for all API requests.</p>
            <input
              type="text"
              value={editServerUrl}
              onChange={(e) => setEditServerUrl(e.target.value)}
              placeholder="https://your-server.com"
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full px-4 py-2.5 bg-[#0D0B18] border border-[#00F0FF]/20 rounded-xl text-sm text-slate-200 font-mono focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
            />
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowServerUrlEdit(false)}
              className="flex-1 py-2.5 holo-glass rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const url = editServerUrl.trim()
                if (!url) {
                  localStorage.removeItem('unipath_server_url')
                } else {
                  localStorage.setItem('unipath_server_url', url)
                }
                setShowServerUrlEdit(false)
                window.location.reload()
              }}
              className="flex-1 py-2.5 neon-btn rounded-xl text-sm font-bold text-white transition-colors"
            >
              Save & Reload
            </button>
          </div>
        </DialogModal>
      )}
    </>
  )

  return content
}
