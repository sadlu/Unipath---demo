import { useStore } from '../store/useStore'
import { Award, BookOpen, Trophy, ScrollText, Mail } from 'lucide-react'

const ACHIEVEMENTS = [
  {
    id: 'Scholar',
    title: 'Scholar',
    subtitle: 'Scholar a scholar achievement most favored achievement conditions.',
    icon: BookOpen,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    id: 'First Save',
    title: 'First Save',
    subtitle: 'First save acounte new entry and learning assessment words.',
    icon: Award,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    id: 'First Discovery',
    title: 'First Discovery',
    subtitle: 'First discovery. Achievement conditions are saved windows.',
    icon: Trophy,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    id: 'Explorer',
    title: 'Explorer',
    subtitle: 'Explorer. Appcalitte achievments the best need itsas engineening.',
    icon: ScrollText,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
  },
]

export default function ProfileView() {
  const userData = useStore((s) => s.userData)

  const xp = userData.xp
  const level = userData.level
  const achievements = userData.achievements

  return (
    <div className="w-full max-w-2xl mx-auto px-5 flex flex-col gap-6 pb-8">
      <div className="w-full bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-2xl font-black text-white shrink-0">
            {userData.displayName[0]}
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <h2 className="text-xl font-extrabold text-white truncate">{userData.displayName}</h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Mail className="w-3 h-3" />
              <span className="truncate">{userData.email}</span>
            </div>
            <span className="text-sm font-semibold text-[#7C5CFC]">Lv {level} &bull; {xp} XP</span>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">{achievements.length * 10 + 139}</span>
                <span className="text-[11px] text-slate-500">Metrics</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-bold text-white">Achievements</h3>
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const Icon = a.icon
            const unlocked = achievements.includes(a.id)
            return (
              <div
                key={a.id}
                className={`rounded-xl p-4 flex flex-col gap-2 border transition-opacity ${
                  unlocked
                    ? 'bg-[#1E1B2E] border-[#2D2A3E]'
                    : 'bg-[#1E1B2E]/50 border-[#2D2A3E]/30 opacity-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg ${unlocked ? a.bg : 'bg-slate-800/50'} border ${unlocked ? a.border : 'border-slate-700/30'} flex items-center justify-center`}
                >
                  <Icon className={`w-4 h-4 ${unlocked ? a.color : 'text-slate-600'}`} />
                </div>
                <h4 className="text-sm font-bold text-white">{a.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed text-balance line-clamp-2">
                  {a.subtitle}
                </p>
                {unlocked && (
                  <span className="text-[10px] font-bold text-emerald-400">&#x2713; Unlocked</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
