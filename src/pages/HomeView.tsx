import { useStore } from '../store/useStore'
import { motion } from 'framer-motion'
import AnimatedNumber from '../components/AnimatedNumber'

const MOCK_PICKS = [
  { id: 1, title: 'Research Internship', tag: '\uD83D\uDD2C', organization: 'MIT Labs', match: 92 },
  { id: 2, title: 'Engineering Workshop', tag: '\u2699\uFE0F', organization: 'Stanford', match: 78 },
  { id: 3, title: 'AI Summit 2026', tag: '\uD83E\uDD16', organization: 'Google', match: 85 },
]

const MAX_LEVEL_XP = 200

export default function HomeView() {
  const userData = useStore((s) => s.userData)
  const displayName = userData?.displayName || 'Fouad'
  const xp = userData?.xp ?? 0
  const fillPercent = Math.min((xp / MAX_LEVEL_XP) * 100, 100)

  return (
    <div className="w-full max-w-2xl mx-auto px-5 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-extrabold text-white tracking-tight text-balance">
          Hey {displayName} &#x2728;
        </h2>
        <p className="text-sm text-slate-400">Here are your personalized opportunities today.</p>
      </div>

      <div className="w-full bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-base font-bold text-white">National Level Workshop</h3>
          <p className="text-sm text-slate-400 leading-relaxed text-balance">
            A national-level science and mathematics workshop designed for exceptional academic talents.
            Students engage in extensive laboratory exploration and advanced prototyping.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
            &#x1F52C; Research Internship
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
            &#x1F91D; General skills
          </span>
        </div>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
          <h3 className="text-base font-bold text-white">Research Internship</h3>
          <p className="text-sm text-slate-400 leading-relaxed text-balance">
            Hands-on research internship opportunity with leading institutions.
            Work on real-world problems and publish your findings.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>1 TBD</span>
            <span className="text-slate-400 font-medium"><AnimatedNumber value={xp} /></span>
            <span>{MAX_LEVEL_XP}</span>
          </div>
          <div className="relative w-full h-2 bg-[#0D0B18] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#7C5CFC] to-[#6D4FF2] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${fillPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-[#7C5CFC]/20 text-[#7C5CFC] border border-[#7C5CFC]/30 rounded-full">
              Lv {userData?.level ?? 1}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Today's Picks</h3>
        <button className="text-xs font-semibold text-[#7C5CFC] hover:text-[#8D6CFF] transition-colors">
          Milestones &rarr;
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 snap-x snap-mandatory scrollbar-none">
        {MOCK_PICKS.map((pick) => (
          <div
            key={pick.id}
            className="snap-start shrink-0 w-48 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl p-4 flex flex-col gap-2"
          >
            <span className="text-lg">{pick.tag}</span>
            <h4 className="text-sm font-bold text-white leading-snug line-clamp-2">{pick.title}</h4>
            <p className="text-xs text-slate-500">{pick.organization}</p>
            <div className="flex items-center gap-1.5 mt-auto">
              <div className="w-full h-1 bg-[#0D0B18] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pick.match}%` }} />
              </div>
              <span className="text-[10px] font-bold text-emerald-400">{pick.match}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
