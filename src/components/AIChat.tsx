import { useEffect, useRef, useState } from 'react'
import { Response } from './ui/ai/response'
import BrowserActionService from '@/services/browserActionService'

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

  // Handle browser actions from AI responses
  async function handleBrowserAction(action: Record<string, unknown>): Promise<string> {
    try {
      const browserActionService = BrowserActionService.getInstance();
      let result;

      const params = action.params as Record<string, unknown>;
      
      switch (action.function) {
        case 'browser_click':
          result = await browserActionService.click(
            params.element as string,
            params.ref as string,
            {
              doubleClick: params.doubleClick as boolean,
              button: params.button as 'left' | 'right' | 'middle',
              modifiers: params.modifiers as ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[]
            }
          );
          break;
        case 'browser_evaluate':
          result = await browserActionService.evaluate(
            params.function as string,
            params.element as string,
            params.ref as string
          );
          break;
        case 'browser_file_upload':
          result = await browserActionService.fileUpload(params.paths as string[]);
          break;
        case 'browser_fill_form':
          result = await browserActionService.fillForm(params.fields as Array<{
            name: string;
            type: 'textbox' | 'checkbox' | 'radio' | 'combobox' | 'slider';
            ref: string;
            value: string | boolean;
          }>);
          break;
        case 'browser_navigate':
          result = await browserActionService.navigate(params.url as string);
          break;
        case 'browser_navigate_back':
          result = await browserActionService.navigateBack();
          break;
        case 'browser_press_key':
          result = await browserActionService.pressKey(params.key as string);
          break;
        case 'browser_select_option':
          result = await browserActionService.selectOption(
            params.element as string,
            params.ref as string,
            params.values as string[]
          );
          break;
        case 'browser_snapshot':
          result = await browserActionService.snapshot();
          break;
        case 'browser_wait_for':
          result = await browserActionService.waitFor(params as {
            time?: number;
            text?: string;
            textGone?: string;
          });
          break;
        default:
          return `Unknown browser action: ${action.function}`;
      }

      if (result.success) {
        return `✅ Browser action "${action.function}" executed successfully. ${JSON.stringify(result.data)}`;
      } else {
        return `❌ Browser action "${action.function}" failed: ${result.error}`;
      }
    } catch (error) {
      return `❌ Error executing browser action: ${error}`;
    }
  }

  // Parse AI response for browser actions
  async function parseAndExecuteActions(content: string): Promise<string> {
    try {
      // Look for JSON objects that might be browser actions
      const jsonMatches = content.match(/\{[^{}]*"function"[^{}]*\}/g);
      if (!jsonMatches) {
        return content;
      }

      let processedContent = content;
      
      for (const jsonMatch of jsonMatches) {
        try {
          const action = JSON.parse(jsonMatch);
          if (action.function && action.function.startsWith('browser_')) {
            const actionResult = await handleBrowserAction(action);
            processedContent = processedContent.replace(jsonMatch, actionResult);
          }
        } catch (parseError) {
          // If it's not a valid JSON, continue
          console.log('parsing error', parseError)
          continue;
        }
      }

      return processedContent;
    } catch (error) {
      console.log('error', error);
      return content;
    }
  }

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
      
      // Process the reply for browser actions
      const processedReply = await parseAndExecuteActions(reply);
      
      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: processedReply
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


