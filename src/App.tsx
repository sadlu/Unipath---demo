import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/useStore'
import { useIsMobile } from './hooks/useIsMobile'
import TitleBar from './components/TitleBar'
import MobileHeader from './components/MobileHeader'
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
import TutorialOverlay from './components/TutorialOverlay'

import { initPeopleUser } from './services/api'

export default function App() {
  const isMobile = useIsMobile()
  const view = useStore((s) => s.view)
  const userData = useStore((s) => s.userData)
  const authMethod = useStore((s) => s.authMethod)
  const preferences = useStore((s) => s.preferences)
  const [chatTargetUid, setChatTargetUid] = useState<string | undefined>(undefined)
  const [peopleInitialized, setPeopleInitialized] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('unipath_auth_token')
    if (token && !authMethod) {
      useStore.getState().restoreSession()
    }
  }, [])

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
    <div className={`w-full h-screen bg-[#13111C] text-slate-100 flex flex-col relative overflow-hidden font-sans ${isMobile ? 'mobile-layout' : ''}`}>
      {isMobile ? (
        <MobileHeader />
      ) : (
        <TitleBar />
      )}

      <div className="fixed top-[-20vh] left-[-10vw] w-[40vw] h-[40vw] rounded-full bg-[#7C5CFC]/10 blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10vh] right-[-5vw] w-[30vw] h-[30vw] rounded-full bg-[#6EE7B7]/8 blur-[100px] pointer-events-none z-0" />
      <div className="fixed bottom-[20vh] left-[-8vw] w-[25vw] h-[25vw] rounded-full bg-blue-500/6 blur-[80px] pointer-events-none z-0" />

      <main className={`flex-1 w-full flex flex-col items-center justify-start z-10 overflow-y-auto min-h-0 ${isMobile ? 'pt-14 pb-20 px-0' : 'pt-16 pb-4'}`}>
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
      {!userData.hasSeenTutorial && <TutorialOverlay />}
    </div>
  )
}
