'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, Battery, BatteryLow, BatteryWarning, BatteryFull } from 'lucide-react'

const DAILY_LIMIT = 1_000_000 // Gemini free tier: 1M tokens/day
const STORAGE_KEY = 'cac_chatbot_usage'

const todayKey = () => new Date().toISOString().slice(0, 10)

const loadUsage = () => {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    if (parsed.date !== todayKey()) return 0
    return parsed.tokens || 0
  } catch { return 0 }
}

const saveUsage = (tokens) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), tokens }))
  } catch {}
}

const formatTokens = (n) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toString()

export default function MatchChatBot({ matchContext }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokensUsed, setTokensUsed] = useState(0)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setTokensUsed(loadUsage())
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || !matchContext) return

    const userMsg = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, matchContext }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.provider === 'gemini' && data.tokens) {
        const newTotal = loadUsage() + data.tokens
        saveUsage(newTotal)
        setTokensUsed(newTotal)
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[340px] sm:w-[380px] rounded-[22px] border-2 border-[#D6DBD3] bg-white shadow-[0_20px_50px_rgba(11,13,11,0.18)] flex flex-col overflow-hidden"
          style={{ height: '480px' }}>

          {/* Header */}
          <div className="bg-black text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={16} />
              <span className="font-black uppercase tracking-widest text-xs">Match Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const remaining = Math.max(0, DAILY_LIMIT - tokensUsed)
                const pct = (remaining / DAILY_LIMIT) * 100
                const Icon = pct > 60 ? BatteryFull : pct > 30 ? Battery : pct > 10 ? BatteryLow : BatteryWarning
                const color = pct > 30 ? '#6BDB58' : pct > 10 ? '#9BE58C' : '#9AA397'
                return (
                  <div
                    className="flex items-center gap-1 bg-white text-black px-1.5 py-0.5 rounded-full"
                    title={`${formatTokens(remaining)} / ${formatTokens(DAILY_LIMIT)} free tokens remaining today`}
                  >
                    <Icon size={14} style={{ color }} />
                    <span className="text-[9px] font-black font-mono">{Math.round(pct)}%</span>
                  </div>
                )
              })()}
              <span className="text-[9px] bg-[#6BDB58] text-black px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                Match Data Only
              </span>
              <button onClick={() => setOpen(false)} className="hover:text-[#6BDB58]">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-sm">
            {messages.length === 0 && (
              <div className="text-center text-[#9AA397] text-xs uppercase font-bold mt-8 px-4">
                <Bot size={28} className="mx-auto mb-2 opacity-30" />
                Ask anything about this match — stats, players, goals, pressing, and more.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed rounded-2xl ${
                  m.role === 'user'
                    ? 'bg-black text-white'
                    : 'bg-[#F0F2EE] text-black'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-2xl bg-[#F0F2EE] text-xs font-mono flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Analysing...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#D6DBD3] flex shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about this match..."
              className="flex-1 px-4 py-3 text-sm outline-none border-none bg-white placeholder-[#9AA397]"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-black text-white px-4 flex items-center justify-center hover:bg-[#6BDB58] hover:text-black disabled:opacity-40 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-[#0B0D0B] text-white w-14 h-14 rounded-full shadow-[0_10px_30px_rgba(11,13,11,0.25)] flex items-center justify-center hover:bg-[#6BDB58] hover:text-black transition-colors"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}
