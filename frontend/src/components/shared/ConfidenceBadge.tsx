'use client'

import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  value: number
  className?: string
  showBar?: boolean
}

export default function ConfidenceBadge({ value, className, showBar = false }: ConfidenceBadgeProps) {
  const pct = Math.round(value * 100)
  const color = pct >= 85 ? 'var(--accent-green)' : pct >= 70 ? 'var(--accent-cyan)' : pct >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)'

  return (
    <span className={cn('inline-flex flex-col gap-0.5', className)}>
      <span className="font-jetbrains text-xs font-semibold" style={{ color }}>
        {pct}%
      </span>
      {showBar && (
        <span className="w-12 h-0.5 rounded-full bg-[var(--border-default)] overflow-hidden">
          <span
            className="block h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </span>
      )}
    </span>
  )
}
