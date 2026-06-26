import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, ArrowLeft, ChevronRight, MessageCircle, ShieldAlert, BadgeCheck, ImagePlus, Plus, Search } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { motion, AnimatePresence } from 'framer-motion'
import { getConversations, getMessages, sendMessage, getProfile, sendMessageWithImage, uploadChatImage, sendTypingIndicator, getTypingStatus, markMessagesRead, getApiBase } from '../services/api'
import type { Conversation, ChatMessage, PeopleUser } from '../types'
import toast from 'react-hot-toast'

function isGuestEmail(email: string) { return !email || email === 'guest@unipath.local' || !email.includes('@') }

interface ChatViewProps { startChatUid?: string; onBack?: () => void }

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }
const rowVariants = { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }

export default function ChatView({ startChatUid, onBack }: ChatViewProps) {
  const isMobile = useIsMobile()
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
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const lastMsgCount = useRef(0)

  const showNotification = useCallback((title: string, body: string) => {
    if (document.hidden && window.electronAPI?.showNotification) window.electronAPI.showNotification(title, body)
  }, [])

  const loadConversations = useCallback(async () => {
    try { const convos = await getConversations(userData.uid); setConversations(convos) } catch {}
  }, [userData.uid])

  const loadProfile = useCallback(async (uid: string) => {
    try { const profile = await getProfile(uid); setActiveUser(profile) } catch {}
  }, [])

  const loadMessages = useCallback(async (uid: string) => {
    try { const msgs = await getMessages(userData.uid, uid); lastMsgCount.current = msgs.length; setMessages(msgs) } catch {}
  }, [userData.uid])

  useEffect(() => { getProfile(userData.uid).then(p => { if (p) setMyBackendVerified(Boolean(p.email_verified)) }).catch(() => {}) }, [userData.uid])
  useEffect(() => { if (startChatUid) { setActiveChat(startChatUid); loadProfile(startChatUid); loadMessages(startChatUid) } }, [startChatUid, loadProfile, loadMessages])
  useEffect(() => { if (!activeChat) loadConversations() }, [activeChat])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (!activeChat) return
    lastMsgCount.current = messages.length
    const interval = setInterval(async () => {
      const prevCount = lastMsgCount.current; await loadMessages(activeChat)
      if (lastMsgCount.current > prevCount) showNotification('New message', `${activeUser?.display_name || activeChat} sent a message`)
      const typing = await getTypingStatus(activeChat, userData.uid); setOtherTyping(typing)
    }, 3000)
    return () => clearInterval(interval)
  }, [activeChat, activeUser, userData.uid, showNotification, loadMessages])
  useEffect(() => { if (activeChat) markMessagesRead(userData.uid, activeChat) }, [activeChat, messages, userData.uid])

  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()
  function handleTyping(value: string) {
    setInput(value)
    if (!activeChat) return
    sendTypingIndicator(userData.uid, activeChat, true)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => sendTypingIndicator(userData.uid, activeChat, false), 2000)
  }

  function selectChat(uid: string) { setActiveChat(uid); loadProfile(uid); loadMessages(uid) }

  async function handleSendImage(file: File) {
    if (!activeChat || sending) return
    setSending(true)
    try {
      const upload = await uploadChatImage(file)
      if (!upload.ok || !upload.url) { toast.error('Image upload failed'); return }
      const result = await sendMessageWithImage(userData.uid, activeChat, '', upload.url)
      if (result.ok) loadMessages(activeChat)
    } catch { toast.error('Failed to send image') }
    setSending(false)
  }

  async function handleSend() {
    if ((!input.trim() && !pendingImage) || !activeChat || sending) return
    setSending(true)
    if (pendingImage) { await handleSendImage(pendingImage); setPendingImage(null) }
    if (input.trim()) {
      const result = await sendMessage(userData.uid, activeChat, input.trim())
      if (result.ok) { setInput(''); loadMessages(activeChat) }
      else toast.error(result.error || 'Failed to send')
    }
    setSending(false)
  }

  async function pickImage() {
    if (window.electronAPI) {
      const result = await window.electronAPI.selectImage()
      if (!result.canceled && result.data && result.ext) {
        const byteChars = atob(result.data)
        const byteArray = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i)
        const file = new File([byteArray], result.name || `image.${result.ext}`, { type: `image/${result.ext}` })
        await handleSendImage(file)
      }
    } else fileInputRef.current?.click()
  }

  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  function goBack() { setActiveChat(null); setActiveUser(null); setMessages([]); if (onBack) onBack() }

  if (activeChat) {
    return (
      <div className={`w-full ${isMobile ? 'px-3' : 'max-w-2xl mx-auto px-5'} pb-4 flex flex-col h-full`}>
        <div className="flex items-center gap-3 py-3 border-b border-[#00F0FF]/10 shrink-0">
          <motion.button onClick={goBack} whileTap={{ scale: 0.85 }} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </motion.button>
          {activeUser && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#7C5CFC] flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden shadow-lg shadow-[#00F0FF]/20">
                {activeUser.avatar_url ? <img src={activeUser.avatar_url.startsWith('http') ? activeUser.avatar_url : `${getApiBase()}${activeUser.avatar_url}`} className="w-full h-full object-cover" alt="" /> : activeUser.display_name[0]}
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
              <p className="text-xs text-amber-300 leading-relaxed">Verify your email in <span className="font-bold">Settings → Privacy & Security</span> to send messages.</p>
            </div>
          )}
          {activeUser && !activeUser.email_verified && !isGuestEmail(activeUser.email) && myEmailVerified && (
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-500/10 border border-slate-500/20 rounded-xl mb-2">
              <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-400 leading-relaxed">{activeUser.display_name} hasn't verified their email yet.</p>
            </div>
          )}
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center"><p className="text-sm text-slate-500">No messages yet. Say hello!</p></div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const isMe = m.from_uid === userData.uid
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] md:max-w-[75%] px-3.5 py-2.5 md:px-3.5 md:py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-gradient-to-r from-[#7C5CFC] to-[#00F0FF] text-white rounded-br-md shadow-lg shadow-[#00F0FF]/20' : 'holo-glass text-slate-200 rounded-bl-md'}`}>
                    {m.image_url && <img src={m.image_url.startsWith('http') ? m.image_url : `${getApiBase()}${m.image_url}`} className="max-w-full rounded-lg mb-1.5" alt="Shared image" />}
                    {m.content && <span>{m.content}</span>}
                    {isMe && <span className={`block text-right text-[10px] mt-0.5 ${m.read ? 'text-emerald-400' : 'text-slate-600'}`}>{m.read ? 'Read' : 'Sent'}</span>}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 pt-2 border-t border-[#00F0FF]/10 shrink-0 relative">
          <motion.button onClick={pickImage} whileTap={{ scale: 0.85 }} className="px-4 py-3 md:px-3 md:py-2.5 holo-glass rounded-xl hover:bg-white/5 transition-colors shrink-0">
            <ImagePlus className="w-5 h-5 md:w-4 md:h-4 text-[#00F0FF]" />
          </motion.button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSendImage(f); e.target.value = '' }} />
          {otherTyping && <div className="absolute -top-5 left-14 text-[11px] text-[#00F0FF] italic animate-pulse">typing...</div>}
          <input
            type="text" value={input} onChange={(e) => handleTyping(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Type a message..." disabled={sending}
            className="flex-1 px-4 py-3 md:px-4 md:py-2.5 holo-glass text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition-all input-glow disabled:opacity-40"
          />
          <motion.button onClick={handleSend} disabled={(!input.trim() && !pendingImage) || sending} whileTap={{ scale: 0.85 }} className="neon-btn px-5 py-3 md:px-4 md:py-2.5 disabled:opacity-40 rounded-xl">
            <Send className="w-5 h-5 md:w-4 md:h-4 text-white" />
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${isMobile ? 'px-4' : 'max-w-2xl mx-auto px-5'} pb-8 flex flex-col gap-4`}>
      <h2 className="text-xl font-extrabold text-white">Messages</h2>

      <div className="relative holo-glass rounded-xl overflow-hidden">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00F0FF]/50 z-10" />
        <input
          type="text"
          placeholder="Search conversations..."
          className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-transparent border-0 text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition-all"
        />
      </div>

      {conversations.length === 0 && (
        <div className="flex flex-col items-center gap-3 mt-10 text-slate-500">
          <MessageCircle className="w-10 h-10" />
          <p className="text-sm">No conversations yet</p>
          <p className="text-xs">Go to <span className="text-[#00F0FF]">People</span> tab to find and message others</p>
        </div>
      )}

      <motion.div className="flex flex-col gap-2" variants={listVariants} initial="hidden" animate="visible">
        <AnimatePresence>
          {conversations.map((c) => (
            <motion.button
              key={c.other_uid}
              variants={rowVariants}
              layout
              onClick={() => selectChat(c.other_uid)}
              className="w-full flex items-center gap-3 px-4 py-4 md:py-3 holo-glass rounded-xl hover:bg-white/5 transition-all text-left group"
              whileHover={{ x: 4, borderColor: 'rgba(0,240,255,0.3)' }}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#7C5CFC] flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-[#00F0FF]/20">
                  {c.display_name[0]}
                </div>
                {c.unread > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg">{c.unread}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white truncate">
                    {c.display_name}
                    {c.other_verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 inline ml-1 -mt-0.5" />}
                  </p>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">{c.last_time?.slice(11, 16) || ''}</span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>

      <motion.button
        className="fab w-12 h-12 rounded-full neon-btn flex items-center justify-center shadow-2xl"
        whileHover={{ scale: 1.1, boxShadow: '0 0 40px rgba(0,240,255,0.4)' }}
        whileTap={{ scale: 0.9 }}
        animate={{ boxShadow: ['0 0 20px rgba(0,240,255,0.2)', '0 0 40px rgba(0,240,255,0.4)', '0 0 20px rgba(0,240,255,0.2)'] }}
        transition={{ duration: 2, repeat: Infinity }}
        onClick={() => toast('Go to People tab to start a new conversation')}
        style={{ position: isMobile ? 'fixed' : 'absolute', bottom: isMobile ? 80 : -20 }}
      >
        <Plus className="w-5 h-5 text-white" />
      </motion.button>
    </div>
  )
}
