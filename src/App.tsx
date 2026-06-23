import { useState, useRef, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/useStore'
import TitleBar from './components/TitleBar'
import BottomDock from './components/BottomDock'
import ErrorBoundary from './components/ErrorBoundary'
import LoginScreen from './components/LoginScreen'
import HomeView from './pages/HomeView'
import DiscoverView from './pages/DiscoverView'
import ExploreView from './pages/ExploreView'
import ProfileView from './pages/ProfileView'
import SettingsView from './pages/SettingsView'
import PeopleView from './pages/PeopleView'
import ChatView from './pages/ChatView'
import AchievementModal from './components/AchievementModal'
import ConfettiOverlay from './components/ConfettiOverlay'

import { initPeopleUser } from './services/api'

export default function App() {
  const view = useStore((s) => s.view)
  const userData = useStore((s) => s.userData)
  const authMethod = useStore((s) => s.authMethod)
  const logout = useStore((s) => s.logout)
  const preferences = useStore((s) => s.preferences)
  const [chatTargetUid, setChatTargetUid] = useState<string | undefined>(undefined)
  const [peopleInitialized, setPeopleInitialized] = useState(false)

  useEffect(() => {
    if (authMethod && userData.uid && !peopleInitialized) {
      setPeopleInitialized(true)
      initPeopleUser(userData.uid, userData.displayName, userData.email).catch(() => {})
    }
  }, [authMethod, userData.uid])

  useEffect(() => {
    const isDark = preferences.theme === 'dark' ||
      (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
    applyBgTheme(isDark)
    document.documentElement.style.setProperty('--accent', preferences.accentColor)
  }, [])

  useEffect(() => {
    if (preferences.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches)
        applyBgTheme(e.matches)
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [preferences.theme])

  function applyBgTheme(isDark: boolean) {
    document.documentElement.style.setProperty('--bg-primary', isDark ? '#13111C' : '#FFFFFF')
    document.documentElement.style.setProperty('--bg-secondary', isDark ? '#1C192C' : '#F5F5F7')
  }

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleStartChat(uid: string) {
    setChatTargetUid(uid)
    useStore.getState().setView('chat')
  }

  function renderView() {
    switch (view) {
      case 'home':
        return <HomeView />
      case 'discover':
        return <DiscoverView />
      case 'explore':
        return <ExploreView />
      case 'profile':
        return <ProfileView />
      case 'settings':
        return <SettingsView />
      case 'people':
        return <PeopleView onStartChat={handleStartChat} />
      case 'chat':
        return <ChatView startChatUid={chatTargetUid} onBack={() => setChatTargetUid(undefined)} />
      default:
        return <HomeView />
    }
  }

  if (!authMethod) {
    return <LoginScreen />
  }

  return (
    <div className="w-full h-screen bg-[#13111C] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      <TitleBar />

      <div className="fixed top-3 right-4 z-50" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/5 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
            {userData.displayName?.[0] || '?'}
          </div>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-sm font-semibold text-white truncate">{userData.displayName}</p>
              <p className="text-xs text-slate-500 truncate">
                {authMethod === 'local' ? 'Local Account' : 'Guest'}
              </p>
            </div>
            <div className="py-1">
              <button
                onClick={() => { logout(); setDropdownOpen(false) }}
                className="w-full px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-white/5 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 w-full flex flex-col items-center justify-start pt-12 pb-4 z-10 overflow-y-auto min-h-0">
        <ErrorBoundary key={view}>
          {renderView()}
        </ErrorBoundary>
      </main>
      <BottomDock />

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1E1B2E',
            color: '#f1f5f9',
            border: '1px solid #2D2A3E',
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
      />
      <ConfettiOverlay />
      <AchievementModal />
    </div>
  )
}
