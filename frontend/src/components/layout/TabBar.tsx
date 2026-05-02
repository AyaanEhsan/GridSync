'use client'

import { motion } from 'motion/react'
import { Activity, AlertTriangle, ClipboardList, BookOpen, BarChart3, Settings2 } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import type { TabId } from '@/lib/constants'

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'grid-monitor', label: 'Grid Monitor', Icon: Activity },
  { id: 'incidents', label: 'Incidents', Icon: AlertTriangle },
  { id: 'shift-log', label: 'Shift Log', Icon: ClipboardList },
  { id: 'playbook', label: 'Playbook', Icon: BookOpen },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: Settings2 },
]

export default function TabBar() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  return (
    <div
      role="tablist"
      aria-label="Main navigation tabs"
      className="flex h-10 items-end border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex-shrink-0 overflow-x-auto hide-scrollbar"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id

        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${id}`}
            onClick={() => setActiveTab(id)}
            className={cn(
              'relative flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-colors flex-shrink-0 cursor-pointer select-none',
              isActive
                ? 'text-white bg-[var(--bg-elevated)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            )}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
            <span>{label}</span>

            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--accent-cyan)]"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
