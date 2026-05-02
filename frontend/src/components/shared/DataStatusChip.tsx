'use client'

import { useGridStore } from '@/stores/gridStore'
import type { FetchStatus } from '@/stores/gridStore'
import { formatDistanceToNowStrict } from 'date-fns'
import { Loader2, Clock, Wifi, WifiOff, AlertTriangle } from 'lucide-react'

interface Config {
  icon: React.ReactNode
  label: string
  color: string
  bg: string
  pulse?: boolean
}

function statusConfig(status: FetchStatus, hasData: boolean): Config {
  switch (status) {
    case 'loading':
      return {
        icon: <Loader2 className="w-2.5 h-2.5 animate-spin" />,
        label: 'SYNCING',
        color: 'var(--accent-amber)',
        bg: 'var(--accent-amber-dim, rgba(217,119,6,0.12))',
      }
    case 'live':
      return {
        icon: <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] inline-block" />,
        label: 'LIVE',
        color: 'var(--accent-green)',
        bg: 'var(--accent-green-dim)',
        pulse: true,
      }
    case 'partial':
      return {
        icon: <AlertTriangle className="w-2.5 h-2.5" />,
        label: 'PARTIAL',
        color: 'var(--accent-amber)',
        bg: 'var(--accent-amber-dim, rgba(217,119,6,0.12))',
      }
    case 'rate_limited':
      return {
        icon: <Clock className="w-2.5 h-2.5" />,
        label: 'RATE LIMITED',
        color: 'var(--accent-amber)',
        bg: 'var(--accent-amber-dim, rgba(217,119,6,0.12))',
      }
    case 'stale':
      return {
        icon: <Wifi className="w-2.5 h-2.5 opacity-50" />,
        label: 'STALE',
        color: 'var(--text-muted)',
        bg: 'var(--bg-elevated)',
      }
    case 'error':
      return {
        icon: <WifiOff className="w-2.5 h-2.5" />,
        label: 'OFFLINE',
        color: 'var(--accent-red)',
        bg: 'rgba(220,38,38,0.12)',
      }
  }
}

export default function DataStatusChip() {
  const fetchStatus = useGridStore((s) => s.fetchStatus)
  const snapshot = useGridStore((s) => s.snapshot)
  const lastFetchedAt = useGridStore((s) => s.lastFetchedAt)
  const demoMode = useGridStore((s) => s.demoMode)

  if (demoMode) return null

  const hasData = snapshot !== null
  const cfg = statusConfig(fetchStatus, hasData)

  const ago = lastFetchedAt
    ? formatDistanceToNowStrict(new Date(lastFetchedAt), { addSuffix: false })
    : null

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] font-medium flex-shrink-0"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}28`,
      }}
      title={ago ? `Last updated ${ago} ago` : undefined}
    >
      <span
        className={cfg.pulse ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''}
        style={{ color: cfg.color }}
      >
        {cfg.icon}
      </span>
      <span className="tracking-widest uppercase leading-none">{cfg.label}</span>
      {ago && fetchStatus !== 'loading' && (
        <span style={{ color: cfg.color, opacity: 0.6 }} className="hidden xl:inline">
          · {ago}
        </span>
      )}
    </div>
  )
}
