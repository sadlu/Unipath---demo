import { useState, useRef, useEffect } from 'react'
import { Toaster, toast as hotToast } from 'react-hot-toast'
import { useStore } from './store/useStore'
import { supabase, signInWithGoogle } from './supabaseClient'
import TitleBar from './components/TitleBar'
import BottomDock from './components/BottomDock'
import ErrorBoundary from './components/ErrorBoundary'
import HomeView from './pages/HomeView'
import DiscoverView from './pages/DiscoverView'
import ExploreView from './pages/ExploreView'
import ProfileView from './pages/ProfileView'
import SettingsView from './pages/SettingsView'
import AchievementModal from './components/AchievementModal'
import ConfettiOverlay from './components/ConfettiOverlay'

export default function App() {
  const view = useStore((s) => s.view)
  const userData = useStore((s) => s.userData)
  const authMode = useStore((s) => s.authMode)
  const setGoogleUser = useStore((s) => s.setGoogleUser)
  const switchToGuest = useStore((s) => s.switchToGuest)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const user = session.user
        setGoogleUser({
          displayName: user.user_metadata?.full_name || user.email || 'Google User',
          email: user.email || '',
          photoURL: user.user_metadata?.avatar_url || '',
          uid: user.id,
        })
        hotToast.success('Signed in with Google!')
      }
    }).catch((err) => {
      console.error('[App] Session check failed:', err)
      setSessionError(true)
      hotToast.error('Login detected, but session sync failed. Please restart the app.')
    }).finally(() => {
      setCheckingSession(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = session.user
        setGoogleUser({
          displayName: user.user_metadata?.full_name || user.email || 'Google User',
          email: user.email || '',
          photoURL: user.user_metadata?.avatar_url || '',
          uid: user.id,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [setGoogleUser])

  async function handleGoogleSignIn() {
    setIsSigningIn(true)
    const { error } = await signInWithGoogle()
    if (error) {
      console.error('[App] Login error:', error)
      hotToast.error(error.message || 'Login failed. Please try again.')
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const user = session.user
        setGoogleUser({
          displayName: user.user_metadata?.full_name || user.email || 'Google User',
          email: user.email || '',
          photoURL: user.user_metadata?.avatar_url || '',
          uid: user.id,
        })
        hotToast.success('Signed in with Google!')
      }
    }
    setIsSigningIn(false)
    setDropdownOpen(false)
  }

  function handleLogout() {
    switchToGuest()
    hotToast('Switched to Guest mode')
    setDropdownOpen(false)
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
      default:
        return <HomeView />
    }
  }

  if (checkingSession) {
    return (
      <div className="w-full min-h-screen bg-[#13111C] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <svg
            className="animate-spin h-10 w-10 text-[#7C5CFC]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-lg font-semibold text-[#7C5CFC] tracking-wide">
            Securing your session...
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {isSigningIn && (
        <div className="fixed inset-0 z-[100] bg-[#13111C]/90 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <svg
              className="animate-spin h-10 w-10 text-[#7C5CFC]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-lg font-semibold text-[#7C5CFC] tracking-wide">
              Signing in with Google...
            </p>
            <p className="text-sm text-slate-500">Complete the auth in your browser</p>
          </div>
        </div>
      )}
    <div className="w-full min-h-screen bg-[#13111C] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      <TitleBar />

      <div className="fixed top-3 right-4 z-50" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/5 transition-colors"
        >
          {userData.photoURL ? (
            <img
              src={userData.photoURL}
              alt=""
              className="w-7 h-7 rounded-full object-cover border border-[#7C5CFC]/30"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
              {userData.displayName?.[0] || 'G'}
            </div>
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-sm font-semibold text-white truncate">{userData.displayName || 'Guest'}</p>
              <p className="text-xs text-slate-500 truncate">{userData.email || ''}</p>
            </div>
            <div className="py-1">
              {authMode === 'guest' ? (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="text-base">G</span>
                  <span>{isSigningIn ? 'Signing in...' : 'Switch to Google Account'}</span>
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-white/5 transition-colors"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 w-full flex flex-col items-center justify-start pt-12 pb-6 z-10 overflow-y-auto">
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
    </>
  )
}
