import { useEffect, useRef, useState } from 'react'
import { Response } from './ui/ai/response'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type AIChatProps = {
  title?: string
  placeholder?: string
  initialMessages?: ChatMessage[]
  onSend?: (message: string, history: ChatMessage[]) => Promise<string> | string
  isThinkingText?: string
  className?: string
}

function AIChat({
  title = 'New AI chat',
  placeholder = 'Ask, search, or make anything…',
  initialMessages = [],
  onSend,
  isThinkingText = 'Thinking…',
  className = ''
}: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, isSending])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed
    }
    const newHistory = [...messages, userMessage]
    setMessages(newHistory)
    setInput('')
    setIsSending(true)

    try {
      let reply = ''
      if (onSend) {
        const maybe = await onSend(trimmed, newHistory)
        reply = typeof maybe === 'string' ? maybe : ''
      } else {
        // Fallback mock reply
        reply = "I'm a placeholder assistant response. Wire `onSend` to connect me to your backend."
      }
      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply
      }
      setMessages(prev => [...prev, botMessage])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div
      className={`w-[360px] max-w-full border border-black/10 rounded-xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden ${className}`.trim()}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-black/10">
        <div className="size-7 rounded-full grid place-items-center bg-gray-100 text-base" aria-hidden>
          🤖
        </div>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="p-3 h-90 overflow-y-auto bg-gray-50" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 text-center mt-6">How can I help you today?</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex my-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={
                `max-w-[80%] rounded-xl text-sm leading-snug whitespace-pre-wrap px-3 py-2 ` +
                (m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white border border-black/10 rounded-bl-sm')
              }
            >
              {m.role === 'assistant' ? (
                <Response className="!grid-cols-1 !gap-1">
                  {m.content}
                </Response>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex my-2 justify-start">
            <div className="max-w-[80%] rounded-xl text-sm leading-snug whitespace-pre-wrap px-3 py-2 text-gray-500 bg-gray-100">
              <Response isStreaming={true} loadingText={isThinkingText} className="!grid-cols-1 !gap-1" />
            </div>
          </div>
        )}
      </div>
      <form className="flex gap-2 px-3.5 py-3 border-t border-black/10 bg-white" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          aria-label="Chat input"
          className="flex-1 border border-black/20 bg-white px-3 py-2 rounded-lg text-sm"
        />
        <button
          type="submit"
          disabled={isSending || input.trim().length === 0}
          className="rounded-lg px-3.5 py-2 text-sm bg-blue-600 text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default AIChat


