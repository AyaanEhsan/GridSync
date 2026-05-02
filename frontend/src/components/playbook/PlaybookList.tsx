'use client'

import { motion } from 'motion/react'
import { ClipboardList } from 'lucide-react'
import ConfidenceBadge from '@/components/shared/ConfidenceBadge'
import { formatRelative } from '@/lib/formatters'
import type { Playbook } from '@/lib/types'

interface PlaybookListProps {
  playbooks: Playbook[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function PlaybookList({ playbooks, selectedId, onSelect }: PlaybookListProps) {
  if (playbooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
        <ClipboardList className="w-8 h-8 opacity-30" />
        <span className="font-mono text-xs">No playbooks match</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 p-3">
      {playbooks.map((pb, i) => {
        const isSelected = selectedId === pb.id
        return (
          <motion.div
            key={pb.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onSelect(pb.id)}
            className="p-3 rounded border cursor-pointer transition-colors"
            style={{
              borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)',
              backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <ClipboardList className="w-4 h-4 text-[var(--accent-indigo)] mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-mono text-xs font-semibold text-[var(--text-primary)]">{pb.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">{pb.steps.length} steps</span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      Last used {formatRelative(pb.lastUsed)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="font-mono text-[9px] text-[var(--text-muted)]">WATT Confidence</span>
                <ConfidenceBadge value={pb.wattConfidence} showBar />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
