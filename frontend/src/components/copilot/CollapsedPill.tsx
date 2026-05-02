'use client'

import { motion } from 'motion/react'
import { Zap } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useCopilotStore } from '@/stores/copilotStore'
import StatusDot from '@/components/shared/StatusDot'
import { AGENT_STATUS_COLORS } from '@/lib/constants'

export default function CollapsedPill() {
  const setCopilotCollapsed = useUIStore((s) => s.setCopilotCollapsed)
  const agentStatus = useCopilotStore((s) => s.agentStatus)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-50"
    >
      <button
        onClick={() => setCopilotCollapsed(false)}
        className="flex flex-col items-center gap-1.5 px-2 py-4 rounded-l-lg border border-r-0 border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition-colors"
        aria-label="Open WATT Co-Pilot panel"
        style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.3)' }}
      >
        <StatusDot status={agentStatus} size="sm" />
        <div className="flex flex-col items-center gap-0.5">
          {['W', 'A', 'T', 'T'].map((c, i) => (
            <span key={i} className="font-mono text-[9px] font-bold text-[var(--accent-cyan)]">
              {c}
            </span>
          ))}
        </div>
        <Zap className="w-3 h-3 text-[var(--accent-indigo)]" />
      </button>
    </motion.div>
  )
}
