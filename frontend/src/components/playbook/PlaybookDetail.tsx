'use client'

import { motion } from 'motion/react'
import { ChevronDown, Play, AlertTriangle } from 'lucide-react'
import { useCopilotStore } from '@/stores/copilotStore'
import { useUIStore } from '@/stores/uiStore'
import ConfidenceBadge from '@/components/shared/ConfidenceBadge'
import { formatRelative } from '@/lib/formatters'
import type { Playbook } from '@/lib/types'

interface PlaybookDetailProps {
  playbook: Playbook
}

export default function PlaybookDetail({ playbook }: PlaybookDetailProps) {
  const addMessage = useCopilotStore((s) => s.addMessage)
  const setAgentStatus = useCopilotStore((s) => s.setAgentStatus)
  const setCopilotCollapsed = useUIStore((s) => s.setCopilotCollapsed)

  const handleExecute = () => {
    setCopilotCollapsed(false)
    addMessage({
      id: `msg-${Date.now()}`,
      type: 'streaming',
      timestamp: Date.now(),
      content: `Loading playbook: "${playbook.title}". I'll guide you through each step while monitoring grid state...`,
      isStreaming: true,
    })
    setAgentStatus('analyzing')
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 min-h-0">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-mono text-sm font-bold text-[var(--text-primary)] mb-1">{playbook.title}</h2>
          <p className="font-mono text-[11px] text-[var(--text-secondary)]">{playbook.description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              Last used {formatRelative(playbook.lastUsed)}
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {playbook.steps.length} steps
            </span>
            <ConfidenceBadge value={playbook.wattConfidence} showBar />
          </div>
        </div>
        <button
          onClick={handleExecute}
          className="flex items-center gap-2 px-3 py-2 rounded font-mono text-xs font-semibold text-white transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))' }}
        >
          <Play className="w-3.5 h-3.5" />
          Execute with WATT
        </button>
      </div>

      {/* Flowchart */}
      <div className="space-y-0">
        {playbook.steps.map((step, i) => (
          <div key={step.id}>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[11px] font-bold"
                  style={{ backgroundColor: 'var(--accent-cyan)', color: 'var(--bg-primary)' }}
                >
                  {step.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-mono text-xs font-semibold text-[var(--text-primary)]">{step.title}</h4>
                    <span className="font-mono text-[10px] text-[var(--text-muted)] flex-shrink-0">~{step.duration}s</span>
                  </div>
                  <p className="font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
                    {step.description}
                  </p>
                  {step.criticalWarning && (
                    <div className="flex items-start gap-1.5 mt-1.5 p-1.5 rounded bg-[var(--accent-amber-dim)]">
                      <AlertTriangle className="w-3 h-3 text-[var(--accent-amber)] flex-shrink-0 mt-0.5" />
                      <p className="font-mono text-[10px] text-[var(--accent-amber)]">{step.criticalWarning}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {i < playbook.steps.length - 1 && (
              <div className="flex justify-start pl-5 my-0.5">
                <ChevronDown className="w-3 h-3 text-[var(--border-default)]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
