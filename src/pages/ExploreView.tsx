import { useState, useEffect, useCallback } from 'react'
import { Search, MapPin, Calendar, Navigation, ExternalLink, Compass, Sparkles, Globe } from 'lucide-react'
import { searchLocalEvents } from '../services/searchService'
import { searchOpportunities } from '../services/api'
import type { LocalEvent } from '../types'
import type { BackendSearchResult } from '../services/api'

const SOURCE_BADGES: Record<LocalEvent['source'] | 'Web', { label: string; color: string }> = {
  Facebook: { label: '📌 Facebook Event', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  Reddit: { label: '💬 Reddit r/Nepal', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  'Kathmandu Post': { label: '📰 Kathmandu Post', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  'Events Nepal': { label: '📅 Events Nepal', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  'E-Kantipur': { label: '🌐 E-Kantipur', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  'Tourism Board': { label: '🏛️ Tourism Board', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  Web: { label: '🌐 Web Result', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
}

function formatNST(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kathmandu',
  })
}

function openMaps(lat: number, lng: number) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

function openUrl(url: string) {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

export default function ExploreView() {
  const [query, setQuery] = useState('')
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([])
  const [backendResults, setBackendResults] = useState<BackendSearchResult[]>([])
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [backendAvailable, setBackendAvailable] = useState(true)

  const doSearch = useCallback(async (q: string) => {
    setLoading(true)
    setHasSearched(true)
    setAiAnswer(null)
    setBackendResults([])

    const trimmed = q.trim()

    try {
      const [beResult, events] = await Promise.all([
        trimmed ? searchOpportunities(trimmed, 8).catch(() => null) : null,
        searchLocalEvents(trimmed, {
          lat: 27.7172,
          lng: 85.3240,
          radiusKm: 30,
        }),
      ])

      if (beResult) {
        setBackendAvailable(true)
        setAiAnswer(beResult.answer)
        setBackendResults(beResult.results)
      } else if (trimmed) {
        setBackendAvailable(false)
      }

      setLocalEvents(events)
    } catch {
      setLocalEvents([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        doSearch(query)
      } else {
        doSearch('')
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  return (
    <div className="w-full max-w-2xl mx-auto px-5 pb-8">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Explore</h2>
        <p className="text-sm text-slate-400">Discover local events happening in Kathmandu Valley.</p>
      </div>

      {/* Search Bar with Location Chip */}
      <div className="flex flex-col gap-2 mb-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, workshops, hackathons..."
            className="w-full pl-11 pr-4 py-3 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#7C5CFC]/10 border border-[#7C5CFC]/20 rounded-full text-xs font-semibold text-[#7C5CFC]">
            <MapPin className="w-3 h-3" />
            <span>Kathmandu, NP</span>
          </div>
          {query.trim() && (
            <span className="text-xs text-slate-500">
              Showing results for "{query}"
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#7C5CFC] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* AI Answer */}
      {!loading && aiAnswer && (
        <div className="bg-gradient-to-br from-[#7C5CFC]/5 to-purple-600/5 border border-[#7C5CFC]/20 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#7C5CFC]" />
            <span className="text-xs font-bold text-[#7C5CFC] uppercase tracking-wider">AI Summary</span>
          </div>
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{aiAnswer}</div>
        </div>
      )}

      {/* Backend unavailable notice */}
      {!loading && !backendAvailable && query.trim() && (
        <div className="flex items-center gap-2 px-4 py-2 mb-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
          <Globe className="w-3.5 h-3.5 shrink-0" />
          <span>Backend offline — showing local event data only</span>
        </div>
      )}

      {/* Web Results from Backend */}
      {!loading && backendResults.length > 0 && (
        <div className="flex flex-col gap-3 mb-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Web Search Results</h4>
          {backendResults.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-4 flex flex-col gap-2 hover:border-[#7C5CFC]/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-white leading-snug flex-1 group-hover:text-[#7C5CFC] transition-colors">{r.title}</h3>
                <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-sky-500/10 text-sky-400 border-sky-500/20">
                  {r.source_site || 'Web'}
                </span>
              </div>
              {r.snippet && (
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{r.snippet}</p>
              )}
              <span className="text-[11px] text-slate-600 truncate">{r.url}</span>
            </a>
          ))}
        </div>
      )}

      {/* Local Events */}
      {!loading && localEvents.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            {query.trim() ? 'Nearby Events' : 'Upcoming Events in Kathmandu'}
          </h4>
          {localEvents.map((event) => {
            const badge = SOURCE_BADGES[event.source]
            return (
              <div
                key={event.id}
                className="bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-white leading-snug flex-1">{event.title}</h3>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{event.description}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {formatNST(event.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {event.venue}
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openMaps(event.coordinates.lat, event.coordinates.lng)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-xs font-semibold text-sky-400 hover:border-sky-500/30 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Directions
                  </button>
                  <button
                    onClick={() => openUrl(event.sourceUrl)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0D0B18] border border-[#2D2A3E] rounded-xl text-xs font-semibold text-slate-300 hover:border-[#7C5CFC]/30 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Source
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty / No results */}
      {!loading && hasSearched && localEvents.length === 0 && backendResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#7C5CFC]/10 border border-[#7C5CFC]/20 flex items-center justify-center mb-4">
            <Compass className="w-8 h-8 text-[#7C5CFC]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            {query.trim() ? 'No results found' : 'Loading...'}
          </h3>
          <p className="text-sm text-slate-400 max-w-xs text-balance">
            {query.trim()
              ? `No results found for "${query}". Try broadening your search or check back tomorrow.`
              : 'No upcoming events found in Kathmandu Valley at this time.'}
          </p>
        </div>
      )}

      {/* Initial state (before any search) */}
      {!loading && !hasSearched && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#7C5CFC]/10 border border-[#7C5CFC]/20 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-[#7C5CFC]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Explore Kathmandu</h3>
          <p className="text-sm text-slate-400 max-w-xs text-balance">
            Search for workshops, hackathons, and events happening in the Kathmandu Valley.
          </p>
        </div>
      )}
    </div>
  )
}
