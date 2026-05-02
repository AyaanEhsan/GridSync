'use client'

import { motion } from 'motion/react'
import { X, ExternalLink } from 'lucide-react'
import { useIncidentStore } from '@/stores/incidentStore'
import { useCopilotStore } from '@/stores/copilotStore'
import { useUIStore } from '@/stores/uiStore'
import SeverityBadge from '@/components/shared/SeverityBadge'
import { formatDate, formatDuration, formatRelative } from '@/lib/formatters'

export default function IncidentDetail() {
  const selectedId = useIncidentStore((s) => s.selectedIncidentId)
  const incidents = useIncidentStore((s) => s.incidents)
  const setSelectedIncident = useIncidentStore((s) => s.setSelectedIncident)
  const addMessage = useCopilotStore((s) => s.addMessage)
  const setAgentStatus = useCopilotStore((s) => s.setAgentStatus)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  const incident = incidents.find((i) => i.id === selectedId)
  if (!incident) return null

  const handleAnalyze = () => {
    addMessage({
      id: `msg-${Date.now()}`,
      type: 'streaming',
      timestamp: Date.now(),
      content: `Analyzing incident ${incident.nercId ?? incident.id}: ${incident.narrative.slice(0, 120)}...`,
      isStreaming: true,
    })
    setAgentStatus('analyzing')
    setActiveTab('grid-monitor')
    setTimeout(() => setSelectedIncident(null), 300)
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden border-t border-[var(--border-subtle)]"
    >
      <div className="p-4 bg-[var(--bg-elevated)]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {incident.nercId && (
                <span className="font-mono text-[11px] font-bold text-[var(--accent-cyan)]">
                  {incident.nercId}
                </span>
              )}
              <SeverityBadge severity={incident.severity} />
            </div>
            <h3 className="font-mono text-sm font-semibold text-[var(--text-primary)]">
              {incident.type.charAt(0).toUpperCase() + incident.type.slice(1)} Event — {incident.region}
            </h3>
            <p className="font-mono text-[11px] text-[var(--text-muted)] mt-0.5">
              {formatDate(incident.date)} · Duration: {formatDuration(incident.duration)} · {Math.round(incident.loadImpact).toLocaleString()} MW impact
            </p>
          </div>
          <button
            onClick={() => setSelectedIncident(null)}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Close detail"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Narrative</p>
            <p className="font-mono text-xs text-[var(--text-secondary)] leading-relaxed">{incident.narrative}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Outcome</p>
            <p className="font-mono text-xs text-[var(--text-secondary)] leading-relaxed">{incident.outcome}</p>

            {incident.actionsTaken.length > 0 && (
              <div className="mt-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Actions Taken</p>
                <ul className="space-y-1">
                  {incident.actionsTaken.slice(0, 4).map((action, i) => (
                    <li key={i} className="font-mono text-[11px] text-[var(--text-muted)] flex gap-2">
                      <span className="text-[var(--accent-cyan)] flex-shrink-0">·</span>
                      {action.action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {incident.similarityScore && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded bg-[var(--accent-indigo-dim)] border border-[rgba(99,102,241,0.2)]">
            <span className="font-mono text-[11px] text-[var(--accent-indigo)]">Similarity to current conditions:</span>
            <div className="w-24 h-1.5 rounded-full bg-[var(--border-default)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent-indigo)]" style={{ width: `${incident.similarityScore * 100}%` }} />
            </div>
            <span className="font-mono text-[11px] font-bold text-[var(--accent-indigo)]">
              {Math.round(incident.similarityScore * 100)}%
            </span>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          className="flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', color: 'var(--bg-primary)' }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Analyze with WATT
        </button>
      </div>
    </motion.div>
  )
}
