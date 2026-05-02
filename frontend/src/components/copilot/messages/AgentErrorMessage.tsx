'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { formatTimestamp } from '@/lib/formatters'
import { useCopilotStore } from '@/stores/copilotStore'

interface AgentErrorMessageProps {
  content: string
  timestamp: number
  retryable?: boolean
}

export default function AgentErrorMessage({ content, timestamp, retryable }: AgentErrorMessageProps) {
  const retryLastRunDemoAgentRequest = useCopilotStore((s) => s.retryLastRunDemoAgentRequest)

  return (
    <div className="mx-3 my-2 p-3 rounded border border-[rgba(255,107,107,0.4)] bg-[rgba(255,107,107,0.08)]">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent-red)]" aria-hidden />
        <span className="font-mono text-[11px] font-semibold text-[var(--accent-red)]">Agent Error</span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          {formatTimestamp(timestamp, 'HH:mm:ss')}
        </span>
      </div>

      <p className="font-mono text-xs text-[var(--text-secondary)] leading-relaxed">{content}</p>

      {retryable && (
        <button
          onClick={retryLastRunDemoAgentRequest}
          className="mt-2 inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-colors bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <RefreshCw className="w-3 h-3" aria-hidden />
          Retry
        </button>
      )}
    </div>
  )
}

