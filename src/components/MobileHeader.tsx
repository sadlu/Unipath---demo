import { useStore } from '../store/useStore'
import { Flame } from 'lucide-react'

export default function MobileHeader() {
  const userData = useStore((s) => s.userData)
  return (
    <header
      className="w-full z-50 absolute top-0 left-0 right-0 pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between px-4 py-1.5 pointer-events-auto">
        <div className="text-sm font-extrabold text-white tracking-tight">
          UniPath
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[11px] font-bold text-amber-400">{userData.streakDays}</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
            {userData.displayName?.[0] || '?'}
          </div>
        </div>
      </div>
    </header>
  )
}
