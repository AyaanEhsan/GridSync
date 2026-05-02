'use client'

import { useGridStore } from '@/stores/gridStore'
import type { GridState } from '@/lib/types'

const STATE_STYLES: Record<GridState, { gradient: string; animate: boolean }> = {
  nominal: {
    gradient: 'linear-gradient(90deg, #16A34A 0%, #22C55E 50%, #16A34A 100%)',
    animate: false,
  },
  watch: {
    gradient: 'linear-gradient(90deg, #EA580C 0%, #D97706 33%, #EA580C 66%, #D97706 100%)',
    animate: true,
  },
  alert: {
    gradient: 'linear-gradient(90deg, #DC2626 0%, #EA580C 33%, #DC2626 66%, #EA580C 100%)',
    animate: true,
  },
  critical: {
    gradient: 'linear-gradient(90deg, #DC2626 0%, #B91C1C 50%, #DC2626 100%)',
    animate: true,
  },
}

export default function StatusRail() {
  const gridState = useGridStore((s) => s.gridState)
  const style = STATE_STYLES[gridState]

  return (
    <div
      className="h-[2px] w-full flex-shrink-0"
      style={{
        background: style.gradient,
        backgroundSize: '200% 100%',
        animation: style.animate ? 'status-sweep 3s linear infinite' : 'none',
      }}
      role="presentation"
      aria-hidden
    />
  )
}
