'use client'

import { useGridStore } from '@/stores/gridStore'
import type { LMPRow } from '@/lib/types'

function priceColor(lmp: number): string {
  if (lmp >= 200) return 'var(--accent-red)'
  if (lmp >= 80) return 'var(--accent-amber)'
  if (lmp >= 30) return 'var(--accent-green)'
  return 'var(--accent-cyan)'
}

function PriceTile({ label, sub, lmp }: { label: string; sub: string; lmp: LMPRow | null }) {
  const color = lmp ? priceColor(lmp.lmp) : 'var(--text-muted)'
  return (
    <div
      className="flex flex-col justify-between rounded px-2 py-1.5 border border-[var(--border-subtle)] overflow-hidden"
      style={{
        background: lmp ? `linear-gradient(135deg, ${color}11 0%, transparent 70%)` : 'transparent',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-[var(--text-primary)] truncate">{label}</span>
        <span className="font-mono text-[9px] text-[var(--text-muted)] flex-shrink-0 truncate max-w-[50%]">{sub}</span>
      </div>
      {lmp ? (
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-mono text-xl font-semibold leading-none" style={{ color }}>
            ${lmp.lmp.toFixed(2)}
          </span>
          <span className="font-mono text-[9px] text-[var(--text-muted)]">/MWh</span>
        </div>
      ) : (
        <span className="font-mono text-xs text-[var(--text-muted)] mt-1">No data</span>
      )}
      {lmp && (
        <div className="flex gap-2 mt-1 font-mono text-[9px] text-[var(--text-muted)]">
          <span>E ${lmp.energy.toFixed(1)}</span>
          <span>C ${lmp.congestion.toFixed(1)}</span>
          <span>L ${lmp.loss.toFixed(1)}</span>
        </div>
      )}
    </div>
  )
}

export default function RegionalTreemap() {
  const ercot = useGridStore((s) => s.lmpERCOTRealtime)
  const pjm = useGridStore((s) => s.lmpPJMRealtime)

  return (
    <div className="w-full h-full p-2 grid grid-cols-2 gap-3" aria-label="Regional LMP pricing">
      <PriceTile label="ERCOT" sub={ercot?.location ?? 'HB_NORTH'} lmp={ercot} />
      <PriceTile label="PJM" sub={pjm?.location ?? 'PJM RTO'} lmp={pjm} />
    </div>
  )
}
