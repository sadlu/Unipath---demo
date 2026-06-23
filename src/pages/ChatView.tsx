import { useState, useEffect, useRef } from 'react'
import { Send, ArrowLeft, ChevronRight, MessageCircle, User, ShieldAlert, BadgeCheck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { getConversations, getMessages, sendMessage, getProfile } from '../services/api'
import type { Conversation, ChatMessage, PeopleUser } from '../types'
import toast from 'react-hot-toast'

function isGuestEmail(email: string) {
  return !email || email === 'guest@unipath.local' || !email.includes('@')
}

interface ChatViewProps {
  startChatUid?: string
  onBack?: () => void
}

export default function ChatView({ startChatUid, onBack }: ChatViewProps) {
  const userData = useStore((s) => s.userData)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(startChatUid || null)
  const [activeUser, setActiveUser] = useState<PeopleUser | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const myEmail = userData.email || ''
  const [myBackendVerified, setMyBackendVerified] = useState(false)
  const myHasRealEmail = !isGuestEmail(myEmail)
  const myEmailVerified = myHasRealEmail && myBackendVerified

  useEffect(() => {
    getProfile(userData.uid).then(p => {
      if (p) setMyBackendVerified(Boolean(p.email_verified))
    }).catch(() => {})
  }, [userData.uid])

  useEffect(() => {
    if (startChatUid) {
      setActiveChat(startChatUid)
      loadProfile(startChatUid)
      loadMessages(startChatUid)
    }
  }, [startChatUid])

  useEffect(() => {
    if (!activeChat) {
      loadConversations()
    }
  }, [activeChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!activeChat) return
    const interval = setInterval(() => loadMessages(activeChat), 3000)
    return () => clearInterval(interval)
  }, [activeChat])

  async function loadConversations() {
    try {
      const convos = await getConversations(userData.uid)
      setConversations(convos)
    } catch {}
  }

  async function loadProfile(uid: string) {
    try {
      const profile = await getProfile(uid)
      setActiveUser(profile)
    } catch {}
  }

  async function loadMessages(uid: string) {
    try {
      const msgs = await getMessages(userData.uid, uid)
      setMessages(msgs)
    } catch {}
  }

  function selectChat(uid: string) {
    setActiveChat(uid)
    loadProfile(uid)
    loadMessages(uid)
  }

  async function handleSend() {
    if (!input.trim() || !activeChat || sending) return
    setSending(true)
    const result = await sendMessage(userData.uid, activeChat, input.trim())
    if (result.ok) {
      setInput('')
      loadMessages(activeChat)
    } else {
      toast.error(result.error || 'Failed to send')
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function goBack() {
    setActiveChat(null)
    setActiveUser(null)
    setMessages([])
    if (onBack) onBack()
  }

  if (activeChat) {
    return (
      <div className="w-full max-w-2xl mx-auto px-5 pb-4 flex flex-col h-full">
        <div className="flex items-center gap-3 py-3 border-b border-white/5">
          <button onClick={goBack} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          {activeUser && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {activeUser.display_name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{activeUser.display_name}</p>
                <p className="text-xs text-slate-500 truncate">{activeUser.email || ''}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 py-3 flex flex-col gap-2">
          {myHasRealEmail && !myEmailVerified && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300 leading-relaxed">
                Verify your email in{' '}
                <span className="font-bold">Settings → Privacy & Security</span> to send messages.
              </p>
            </div>
          )}
          {activeUser && !activeUser.email_verified && !isGuestEmail(activeUser.email) && myEmailVerified && (
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-500/10 border border-slate-500/20 rounded-xl mb-2">
              <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeUser.display_name} hasn't verified their email yet.
              </p>
            </div>
          )}
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-500">No messages yet. Say hello!</p>
            </div>
          )}
          {messages.map((m) => {
            const isMe = m.from_uid === userData.uid
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-[#7C5CFC] text-white rounded-br-md'
                      : 'bg-[#1E1B2E] border border-[#2D2A3E] text-slate-200 rounded-bl-md'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 pt-2 border-t border-white/5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#7C5CFC]/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-4 py-2.5 bg-[#7C5CFC] hover:bg-[#6D4FF2] disabled:opacity-40 rounded-xl transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-5 pb-8 flex flex-col gap-4">
      <h2 className="text-xl font-extrabold text-white">Messages</h2>

      {conversations.length === 0 && (
        <div className="flex flex-col items-center gap-3 mt-10 text-slate-500">
          <MessageCircle className="w-10 h-10" />
          <p className="text-sm">No conversations yet</p>
          <p className="text-xs">Go to <span className="text-[#7C5CFC]">People</span> tab to find and message others</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {conversations.map((c) => (
          <button
            key={c.other_uid}
            onClick={() => selectChat(c.other_uid)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl hover:bg-white/5 transition-colors text-left"
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C5CFC] to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                {c.display_name[0]}
              </div>
              {c.unread > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {c.unread}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white truncate">
                  {c.display_name}
                  {c.other_verified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 inline ml-1 -mt-0.5" />
                  )}
                </p>
                <span className="text-[10px] text-slate-500 shrink-0 ml-2">{c.last_time?.slice(11, 16) || ''}</span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
