'use client'

import { formatTimestamp } from '@/lib/formatters'

interface OperatorMessageProps {
  content: string
  timestamp: number
  operatorName?: string
}

export default function OperatorMessage({ content, timestamp, operatorName = 'Operator' }: OperatorMessageProps) {
  return (
    <div className="px-3 my-2 flex flex-col items-end gap-1">
      <div
        className="max-w-[85%] px-3 py-2 rounded-l-xl rounded-br-xl"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="font-mono text-xs text-[var(--text-primary)] leading-relaxed">{content}</p>
      </div>
      <span className="font-mono text-[10px] text-[var(--text-muted)]">
        {operatorName} · {formatTimestamp(timestamp, 'HH:mm:ss')}
      </span>
    </div>
  )
}
