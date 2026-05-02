'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Zap, ChevronRight } from 'lucide-react'
import { useCopilotStore } from '@/stores/copilotStore'
import { useUIStore } from '@/stores/uiStore'
import StatusDot from '@/components/shared/StatusDot'
import { AGENT_STATUS_LABELS } from '@/lib/constants'

export default function CopilotHeader() {
  const agentStatus = useCopilotStore((s) => s.agentStatus)
  const setCopilotCollapsed = useUIStore((s) => s.setCopilotCollapsed)

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)] flex-shrink-0">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-[var(--accent-cyan)]" aria-hidden />
        <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">WATT Co-Pilot</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5" aria-live="polite" aria-label={`Agent status: ${AGENT_STATUS_LABELS[agentStatus]}`}>
          <StatusDot status={agentStatus} size="sm" />
          <AnimatePresence mode="wait">
            <motion.span
              key={agentStatus}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="font-mono text-[10px] font-medium"
              style={{
                color: agentStatus === 'monitoring' ? 'var(--accent-green)'
                  : agentStatus === 'analyzing' ? 'var(--accent-amber)'
                  : agentStatus === 'drafting' ? 'var(--accent-cyan)'
                  : 'var(--accent-red)',
              }}
            >
              {AGENT_STATUS_LABELS[agentStatus]}
            </motion.span>
          </AnimatePresence>
        </div>

        <button
          onClick={() => setCopilotCollapsed(true)}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Collapse co-pilot panel"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
