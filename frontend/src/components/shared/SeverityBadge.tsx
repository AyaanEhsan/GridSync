'use client'

import { ShieldAlert, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AlarmSeverity, IncidentSeverity } from '@/lib/types'

type Severity = AlarmSeverity | IncidentSeverity

const SEVERITY_CONFIG: Record<Severity, {
  label: string
  color: string
  bg: string
  Icon: React.ElementType
}> = {
  critical: { label: 'Critical', color: 'text-[var(--accent-red)]',    bg: 'bg-[var(--accent-red-dim)]',    Icon: ShieldAlert },
  major:    { label: 'Major',    color: 'text-[var(--accent-amber)]',   bg: 'bg-[var(--accent-amber-dim)]',  Icon: AlertTriangle },
  minor:    { label: 'Minor',    color: 'text-[var(--accent-cyan)]',    bg: 'bg-[var(--accent-cyan-dim)]',   Icon: AlertTriangle },
  info:     { label: 'Info',     color: 'text-[var(--accent-indigo)]',  bg: 'bg-[var(--accent-indigo-dim)]', Icon: Info },
}

interface SeverityBadgeProps {
  severity: Severity
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export default function SeverityBadge({ severity, showLabel = true, size = 'sm', className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity]
  const { Icon } = config

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono font-medium',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        config.color,
        config.bg,
        className
      )}
      aria-label={`Severity: ${config.label}`}
    >
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} aria-hidden />
      {showLabel && config.label}
    </span>
  )
}
