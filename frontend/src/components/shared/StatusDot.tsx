'use client'

import { cn } from '@/lib/utils'
import { AGENT_STATUS_COLORS } from '@/lib/constants'
import type { AgentStatus, GridState } from '@/lib/types'

type DotVariant = AgentStatus | GridState | 'online' | 'offline'

interface StatusDotProps {
  status: DotVariant
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  className?: string
}

const STATUS_COLORS: Record<string, string> = {
  ...AGENT_STATUS_COLORS,
  nominal: 'var(--accent-green)',
  watch: 'var(--accent-amber)',
  alert: 'var(--accent-red)',
  critical: 'var(--accent-red)',
  online: 'var(--accent-green)',
  offline: 'var(--text-muted)',
}

const SIZE_MAP = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }

export default function StatusDot({ status, size = 'md', pulse = true, className }: StatusDotProps) {
  const color = STATUS_COLORS[status] ?? 'var(--text-muted)'
  const isActive = status !== 'offline' && status !== 'nominal'

  return (
    <span
      className={cn('relative inline-flex rounded-full flex-shrink-0', SIZE_MAP[size], className)}
      style={{ backgroundColor: color }}
      role="presentation"
    >
      {pulse && isActive && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-50"
          style={{ backgroundColor: color }}
        />
      )}
    </span>
  )
}
