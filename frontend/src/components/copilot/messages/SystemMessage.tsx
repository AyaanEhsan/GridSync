'use client'

import { formatTimestamp } from '@/lib/formatters'

interface SystemMessageProps {
  content: string
  timestamp: number
}

export default function SystemMessage({ content, timestamp }: SystemMessageProps) {
  return (
    <div className="px-3 py-1.5 flex items-start gap-2">
      <span
        suppressHydrationWarning
        className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5 flex-shrink-0 w-14"
      >
        {formatTimestamp(timestamp, 'HH:mm:ss')}
      </span>
      <p className="font-mono text-[11px] text-[var(--text-muted)] leading-relaxed">{content}</p>
    </div>
  )
}
