import { useStore } from '../store/useStore'
import { User, Bell, Shield, Settings2, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

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

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(0, value - 10))}
        className="w-8 h-8 rounded-lg bg-[#0D0B18] border border-[#2D2A3E] flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm font-bold shrink-0"
      >
        -
      </button>
      <div className="flex-1 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-[#0D0B18] rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[#7C5CFC]
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:shadow-[#7C5CFC]/40
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[#7C5CFC]
            [&::-moz-range-thumb]:border-0"
        />
        <span className="text-sm font-bold text-[#7C5CFC] w-8 text-right shrink-0">{value}%</span>
      </div>
      <button
        onClick={() => onChange(Math.min(100, value + 10))}
        className="w-8 h-8 rounded-lg bg-[#0D0B18] border border-[#2D2A3E] flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm font-bold shrink-0"
      >
        +
      </button>
    </div>
  )
}

const SETTING_LABELS: Record<string, string> = {
  general1: 'Dark Mode',
  general2: 'Auto-Save',
  general3: 'Desktop Notifications',
}

export default function SettingsView() {
  const userData = useStore((s) => s.userData)
  const authMode = useStore((s) => s.authMode)
  const toggleSetting = useStore((s) => s.toggleSetting)
  const setEmail = useStore((s) => s.setEmail)
  const setSliderValue = useStore((s) => s.setSliderValue)
  const resetAllProgress = useStore((s) => s.resetAllProgress)
  const settings = userData.settings

  function handleAccountToggle() {
    if (authMode === 'guest') {
      toast('You are currently in Guest Mode. Switch to Google Account in the top-right menu.', {
        icon: '\u2139\uFE0F',
        duration: 4000,
      })
    } else {
      toggleSetting('notifications')
    }
  }

  function handleReset() {
    const confirmed = window.confirm(
      'Are you sure? This will permanently delete all your XP, Level, and Settings. This cannot be undone!'
    )
    if (!confirmed) return
    resetAllProgress()
    toast('\uD83D\uDDD1\uFE0F Progress has been wiped. App reset to default.')
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-5 flex flex-col gap-5 pb-8">
      <div className="w-full bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#7C5CFC]" />
          <h3 className="text-sm font-bold text-white">Account Settings</h3>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {userData.photoURL ? (
              <img
                src={userData.photoURL}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-[#7C5CFC]/30 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {userData.displayName[0]}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">{userData.displayName}</span>
              <span className="text-xs text-slate-500">{userData.email}</span>
            </div>
          </div>
          <Toggle checked={settings.notifications} onChange={handleAccountToggle} />
        </div>
      </div>

      <div className="w-full bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#7C5CFC]" />
          <h3 className="text-sm font-bold text-white">Notification Preferences</h3>
        </div>
        <p className="text-xs text-slate-500">Notification Sliders</p>
        <Slider value={userData.sliderValue} onChange={setSliderValue} />
      </div>

      <div className="w-full bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#7C5CFC]" />
          <h3 className="text-sm font-bold text-white">Privacy</h3>
        </div>
        <p className="text-xs text-slate-500">Privacy to settings, textbook and privacy.</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Data Sharing</span>
          <Toggle checked={settings.privacy} onChange={() => toggleSetting('privacy')} />
        </div>
        <input
          type="email"
          value={userData.email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!settings.privacy}
          placeholder="Enter your email"
          className={`w-full px-4 py-2.5 bg-[#0D0B18] border rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors ${
            settings.privacy
              ? 'border-[#2D2A3E]'
              : 'border-[#2D2A3E]/40 text-slate-600 cursor-not-allowed'
          }`}
        />
      </div>

      <div className="w-full bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#7C5CFC]" />
          <h3 className="text-sm font-bold text-white">General</h3>
        </div>
        <div className="flex flex-col gap-3">
          {(['general1', 'general2', 'general3'] as const).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{SETTING_LABELS[key]}</span>
              <Toggle checked={settings[key]} onChange={() => toggleSetting(key)} />
            </div>
          ))}
        </div>
      </div>

      <div className="w-full bg-[#1E1B2E] border border-rose-500/30 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-rose-400">Danger Zone</h3>
        </div>
        <p className="text-xs text-slate-500">Use this to clear test data before a live demo.</p>
        <button
          onClick={handleReset}
          className="w-full py-2.5 bg-[#0D0B18] border border-rose-500/40 hover:border-rose-500 rounded-xl text-sm font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center justify-center gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          Reset All Progress
        </button>
      </div>
    </div>
  )
}
