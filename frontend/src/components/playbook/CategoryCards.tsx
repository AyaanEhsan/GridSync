'use client'

import { motion } from 'motion/react'
import { Zap, Gauge, Flame, Cloud, Shield, Server, Wind, GitBranch } from 'lucide-react'
import { MOCK_PLAYBOOKS } from '@/lib/mock-data/playbookData'
import type { PlaybookCategory } from '@/lib/types'

const CATEGORIES: { id: PlaybookCategory; label: string; Icon: React.ElementType }[] = [
  { id: 'frequency', label: 'Frequency', Icon: Zap },
  { id: 'voltage', label: 'Voltage', Icon: Gauge },
  { id: 'overload', label: 'Overload', Icon: Flame },
  { id: 'weather', label: 'Weather', Icon: Cloud },
  { id: 'cyber', label: 'Cyber', Icon: Shield },
  { id: 'datacenter', label: 'Data Center', Icon: Server },
  { id: 'renewable', label: 'Renewable', Icon: Wind },
  { id: 'cascading', label: 'Cascading', Icon: GitBranch },
]

interface CategoryCardsProps {
  selected: PlaybookCategory | null
  onSelect: (cat: PlaybookCategory | null) => void
}

export default function CategoryCards({ selected, onSelect }: CategoryCardsProps) {
  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, MOCK_PLAYBOOKS.filter((p) => p.category === c.id).length])
  )

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar px-3 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
      {CATEGORIES.map(({ id, label, Icon }) => {
        const isActive = selected === id
        return (
          <motion.button
            key={id}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(isActive ? null : id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded flex-shrink-0 font-mono text-[11px] font-medium transition-colors border"
            style={{
              backgroundColor: isActive ? 'var(--accent-indigo)' : 'transparent',
              borderColor: isActive ? 'var(--accent-indigo)' : 'var(--border-default)',
              color: isActive ? 'white' : 'var(--text-secondary)',
            }}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
            {label}
            {counts[id] > 0 && (
              <span
                className="px-1 rounded text-[9px]"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-elevated)',
                  color: isActive ? 'white' : 'var(--text-muted)',
                }}
              >
                {counts[id]}
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
