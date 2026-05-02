'use client'

import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { formatTimestamp } from '@/lib/formatters'

interface AlertMessageProps {
  content: string
  timestamp: number
  severity?: 'warning' | 'critical'
}

export default function AlertMessage({ content, timestamp, severity = 'warning' }: AlertMessageProps) {
  const isCritical = severity === 'critical'
  const Icon = isCritical ? ShieldAlert : AlertTriangle
  const borderColor = isCritical ? 'var(--accent-red)' : 'var(--accent-amber)'
  const bgColor = isCritical ? 'var(--accent-red-dim)' : 'var(--accent-amber-dim)'
  const textColor = isCritical ? 'var(--accent-red)' : 'var(--accent-amber)'

  return (
    <div
      className="mx-3 my-2 rounded-r p-3 animate-alarm-pulse"
      style={{
        borderLeft: `2px solid ${borderColor}`,
        backgroundColor: bgColor,
      }}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: textColor }} aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wide" style={{ color: textColor }}>
              WATT — {isCritical ? 'CRITICAL' : 'ALERT'}
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {formatTimestamp(timestamp, 'HH:mm:ss')}
            </span>
          </div>
          <p className="font-mono text-xs text-[var(--text-primary)] leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  )
}
