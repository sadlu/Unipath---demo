import { useStore } from '../store/useStore'
import { X, Minus, Square, Flame, Minimize2 } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'

const api = () => window.electronAPI

export default function TitleBar() {
  const view = useStore((s) => s.view)
  const userData = useStore((s) => s.userData)

  const xp = userData.xp
  const level = userData.level
  const streak = userData.streakDays

  return (
    <header className="titlebar-drag w-full flex justify-center pt-3 px-4 z-50 absolute top-0 left-0 right-0 pointer-events-none">
      <div className="glass rounded-2xl px-4 py-2.5 flex items-center justify-between w-full max-w-2xl pointer-events-auto titlebar-no-drag shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-xs font-bold text-amber-400">{streak}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 tracking-wide hidden sm:block">
            Lv {level}
          </span>
          <div className="h-4 w-px bg-white/5 hidden sm:block" />
          <span className="text-[11px] font-semibold text-slate-400 hidden sm:block">
            <AnimatedNumber value={xp} /> XP
          </span>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-[10px] font-bold text-white ml-1">
            {userData.displayName?.[0] || '?'}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => api()?.minimize()}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors active:scale-90"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => api()?.maximize()}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors active:scale-90"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => api()?.close()}
            className="p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors active:scale-90"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
