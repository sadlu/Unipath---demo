import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, GraduationCap, FileText, BookOpen, Lightbulb, TrendingUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { motion, AnimatePresence } from 'framer-motion'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cvAdvise } from '../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  { icon: FileText, label: 'Review my CV', text: 'Please review my profile and tell me how to improve my CV for university applications.' },
  { icon: BookOpen, label: 'Scholarships', text: 'What scholarships can I apply for based on my subjects and level?' },
  { icon: Lightbulb, label: 'Skill gaps', text: 'What skills should I learn to improve my chances at top universities?' },
  { icon: TrendingUp, label: 'Career advice', text: 'Based on my subjects, what career paths should I consider in Nepal?' },
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-emerald-400/60"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  )
}

export default function CVCoachView() {
  const isMobile = useIsMobile()
  const userData = useStore((s) => s.userData)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi ${userData.displayName}! I'm your **CV Coach**. I can help you:\n\n- 📝 Review your profile and improve your CV\n- 🎓 Find scholarships and programs matching your subjects\n- 💡 Identify skill gaps to work on\n- 🚀 Get personalized career advice\n\nWhat would you like help with?`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend(query: string) {
    const q = query.trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)
    setProvider(null)
    const newMessages: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(newMessages)
    try {
      const history = newMessages.map(m => ({ role: m.role, content: m.content }))
      const result = await cvAdvise(userData.uid, q, history)
      if (result.error) {
        setMessages([...newMessages, { role: 'assistant', content: `**Error:** ${result.error}` }])
      } else if (result.answer) {
        const answer = result.answer + (result.provider ? `\n\n---\n*Powered by: ${result.provider}*` : '')
        setMessages([...newMessages, { role: 'assistant', content: answer }])
        setProvider(result.provider)
      } else {
        setMessages([...newMessages, { role: 'assistant', content: '**No response generated.** Please try rephrasing your question.' }])
      }
    } catch (e: any) {
      setMessages([...newMessages, { role: 'assistant', content: `**Connection error:** ${e.message || 'Could not reach the CV Coach. Make sure the backend is running.'}` }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input) }
  }

  return (
    <div className={`w-full ${isMobile ? 'px-3' : 'max-w-3xl mx-auto px-5'} pb-4 flex flex-col h-full`}>
      <div className="flex items-center gap-3 py-3 border-b border-white/5 mb-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-white">CV Coach</h2>
          <p className="text-xs text-slate-500">Personalized AI for your university journey</p>
        </div>
        {provider && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-[#7C5CFC]/10 border border-[#7C5CFC]/20 rounded-full">
            <Sparkles className="w-3 h-3 text-[#7C5CFC]" />
            <span className="text-[10px] font-semibold text-[#7C5CFC]">{provider}</span>
          </div>
        )}
      </div>

      {messages.length === 1 && (
        <div className="grid grid-cols-2 gap-2 mb-4 shrink-0">
          {QUICK_PROMPTS.map((prompt, i) => {
            const Icon = prompt.icon
            return (
              <motion.button
                key={prompt.label}
                onClick={() => handleSend(prompt.text)}
                disabled={loading}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 px-3 py-3 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left disabled:opacity-40"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-300 leading-snug">{prompt.label}</span>
              </motion.button>
            )
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3 pr-1">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[85%] md:max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed bg-[#7C5CFC] text-white rounded-br-md shadow-lg shadow-[#7C5CFC]/20">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[90%] md:max-w-[85%] px-4 py-3 rounded-2xl bg-[#1E1B2E] border border-[#2D2A3E] text-slate-200 rounded-bl-md prose prose-invert prose-sm max-w-none prose-headings:text-white prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2 prose-p:text-slate-300 prose-p:leading-relaxed prose-p:my-1.5 prose-strong:text-emerald-300 prose-strong:font-bold prose-code:text-emerald-400 prose-code:bg-[#0D0B18] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-ul:text-slate-300 prose-li:my-0.5 prose-a:text-sky-400 prose-a:no-underline hover:prose-a:underline prose-hr:border-[#2D2A3E] prose-blockquote:border-emerald-500/50 prose-blockquote:text-slate-400">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </Markdown>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1E1B2E] border border-[#2D2A3E] rounded-2xl rounded-bl-md px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/5 mt-3 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your CV, scholarships, or career..."
          disabled={loading}
          className="flex-1 px-4 py-3 md:py-2.5 bg-[#1E1B2E] border border-[#2D2A3E] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition-all disabled:opacity-40"
        />
        <motion.button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || loading}
          className="px-5 py-3 md:py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl transition-colors"
          whileTap={{ scale: 0.9 }}
        >
          <Send className="w-5 h-5 text-white" />
        </motion.button>
      </div>
    </div>
  )
}
