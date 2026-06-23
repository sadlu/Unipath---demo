import { useStore } from '../store/useStore'
import { X, Minus, Square } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'

export default function TitleBar() {
  const view = useStore((s) => s.view)
  const userData = useStore((s) => s.userData)

  const xp = userData.xp
  const level = userData.level
  const streak = userData.streakDays

  return (
    <header className="titlebar-drag w-full border-b border-white/5 px-5 py-3 flex items-center justify-between bg-[#13111C] z-30 select-none">
      <span className="text-xs font-bold text-[#7C5CFC] tracking-wider titlebar-no-drag">
        Lv {level} &bull; <AnimatedNumber value={xp} /> XP
      </span>
      <h1 className="text-sm font-black tracking-tight text-white titlebar-no-drag">
        UniPath &mdash; <span className="text-slate-400 font-medium capitalize">{view}</span>
      </h1>
      <div className="flex items-center gap-3 titlebar-no-drag">
        <span className="text-xs font-bold text-amber-500 flex items-center gap-1">&#x1F525; {streak}-day streak</span>
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => window.electronAPI?.minimize()}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.electronAPI?.maximize()}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => window.electronAPI?.close()}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
