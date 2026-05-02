'use client'

import { useState, useRef } from 'react'
import { ArrowUp, Command } from 'lucide-react'
import { useCopilotStore } from '@/stores/copilotStore'

const COMMANDS = ['/diagnose', '/playbook', '/handoff', '/analyze', '/escalate']

export default function CopilotInput() {
  const [value, setValue] = useState('')
  const [showCommands, setShowCommands] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendOperatorMessage = useCopilotStore((s) => s.sendOperatorMessage)

  const filteredCommands = value.startsWith('/')
    ? COMMANDS.filter((c) => c.startsWith(value))
    : []

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    sendOperatorMessage(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  return (
    <div className="flex-shrink-0 border-t border-[var(--border-subtle)] p-2 relative">
      {/* Command suggestions */}
      {filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-2 right-2 mb-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded overflow-hidden">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left"
              onClick={() => { setValue(cmd + ' '); textareaRef.current?.focus() }}
            >
              <Command className="w-3 h-3 text-[var(--accent-indigo)]" />
              {cmd}
            </button>
          ))}
        </div>
      )}

      <div
        className="flex items-end gap-2 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 focus-within:border-[var(--accent-cyan)] transition-colors"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setShowCommands(e.target.value.startsWith('/'))
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask WATT something..."
          className="flex-1 font-mono text-xs bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none leading-relaxed"
          style={{ minHeight: '20px', maxHeight: '120px' }}
          aria-label="Message input"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim()}
          className="flex items-center justify-center w-6 h-6 rounded flex-shrink-0 transition-all disabled:opacity-30 enabled:hover:scale-110"
          style={{ backgroundColor: value.trim() ? 'var(--accent-cyan)' : 'var(--bg-tertiary)' }}
          aria-label="Send message"
        >
          <ArrowUp className="w-3.5 h-3.5" style={{ color: value.trim() ? 'var(--bg-primary)' : 'var(--text-muted)' }} />
        </button>
      </div>
      <p className="font-mono text-[9px] text-[var(--text-muted)] mt-1 text-center">
        Enter to send · Shift+Enter for new line · Type / for commands
      </p>
    </div>
  )
}
