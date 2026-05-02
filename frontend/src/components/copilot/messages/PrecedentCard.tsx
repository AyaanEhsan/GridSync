'use client'

import { memo } from 'react'
import { motion } from 'motion/react'
import { format } from 'date-fns'
import type { Precedent } from '@/lib/types'

interface PrecedentCardProps {
  precedent: Precedent
  index: number
}

const PrecedentCard = memo(function PrecedentCard({ precedent, index }: PrecedentCardProps) {
  const simPct = Math.round(precedent.similarity * 100)
  const simColor = simPct >= 85 ? 'var(--accent-green)' : simPct >= 70 ? 'var(--accent-cyan)' : 'var(--accent-amber)'

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.15, duration: 0.3 }}
      className="mx-3 my-1.5 p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <span className="font-mono text-[10px] font-bold text-[var(--accent-cyan)]">
            {precedent.nercId}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-muted)] ml-2">
            {format(new Date(precedent.date), 'MMM yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="font-mono text-[10px] font-bold" style={{ color: simColor }}>
            {simPct}%
          </span>
          <div className="w-14 h-1 rounded-full bg-[var(--border-default)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${simPct}%`, backgroundColor: simColor }}
            />
          </div>
        </div>
      </div>

      <p className="font-mono text-[11px] text-[var(--text-secondary)] leading-snug mb-1.5">
        {precedent.description}
      </p>

      <div className="space-y-0.5">
        <p className="font-mono text-[10px] text-[var(--text-muted)]">
          <span className="text-[var(--accent-amber)]">Action: </span>
          {precedent.operatorAction}
        </p>
        <p className="font-mono text-[10px] text-[var(--text-muted)]">
          <span className="text-[var(--accent-green)]">Outcome: </span>
          {precedent.outcome}
        </p>
      </div>
    </motion.div>
  )
})

interface PrecedentListProps {
  precedents: Precedent[]
}

export default function PrecedentList({ precedents }: PrecedentListProps) {
  return (
    <div className="my-1">
      <div className="px-3 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          Precedent matches ({precedents.length})
        </span>
      </div>
      {precedents.map((p, i) => (
        <PrecedentCard key={p.nercId} precedent={p} index={i} />
      ))}
    </div>
  )
}
