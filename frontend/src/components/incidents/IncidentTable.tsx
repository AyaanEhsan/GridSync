'use client'

import { useState, Fragment } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useIncidentStore } from '@/stores/incidentStore'
import SeverityBadge from '@/components/shared/SeverityBadge'
import IncidentDetail from './IncidentDetail'
import { formatDate, formatDuration } from '@/lib/formatters'

type SortKey = 'date' | 'severity' | 'loadImpact' | 'duration'
type SortDir = 'asc' | 'desc'

const SEVERITY_ORDER = { critical: 0, major: 1, minor: 2, info: 3 }

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--accent-red)',
  under_review: 'var(--accent-amber)',
  resolved: 'var(--accent-green)',
}

export default function IncidentTable() {
  // Read raw data + filters from store separately — never call functions inside selectors
  const allIncidents = useIncidentStore((s) => s.incidents)
  const filters = useIncidentStore((s) => s.filters)
  const selectedId = useIncidentStore((s) => s.selectedIncidentId)
  const setSelectedIncident = useIncidentStore((s) => s.setSelectedIncident)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'date', dir: 'desc' })
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 15

  // Filter inline — result is stable because inputs are stable references
  const filtered = allIncidents.filter((inc) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !inc.narrative.toLowerCase().includes(q) &&
        !inc.region.toLowerCase().includes(q) &&
        !inc.type.toLowerCase().includes(q) &&
        !(inc.nercId?.toLowerCase().includes(q))
      ) return false
    }
    if (filters.severity && inc.severity !== filters.severity) return false
    if (filters.type && inc.type !== filters.type) return false
    if (filters.region && inc.region !== filters.region) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sort.key === 'date') cmp = a.date - b.date
    else if (sort.key === 'severity') cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    else if (sort.key === 'loadImpact') cmp = a.loadImpact - b.loadImpact
    else if (sort.key === 'duration') cmp = a.duration - b.duration
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort.key !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
    return sort.dir === 'asc' ? <ChevronUp className="w-3 h-3 text-[var(--accent-cyan)]" /> : <ChevronDown className="w-3 h-3 text-[var(--accent-cyan)]" />
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--bg-secondary)]">
            <tr className="border-b border-[var(--border-subtle)]">
              {[
                { label: 'ID', key: null, w: 'w-24' },
                { label: 'Date', key: 'date' as SortKey, w: 'w-28' },
                { label: 'Type', key: null, w: 'w-28' },
                { label: 'Region', key: null, w: 'w-20' },
                { label: 'Severity', key: 'severity' as SortKey, w: 'w-24' },
                { label: 'Duration', key: 'duration' as SortKey, w: 'w-20' },
                { label: 'MW Impact', key: 'loadImpact' as SortKey, w: 'w-24' },
                { label: 'Status', key: null, w: 'w-28' },
              ].map(({ label, key, w }) => (
                <th
                  key={label}
                  className={`${w} px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] ${key ? 'cursor-pointer hover:text-[var(--text-secondary)]' : ''}`}
                  onClick={() => key && toggleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    {key && <SortIcon col={key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((incident, idx) => (
              <Fragment key={incident.id}>
                <motion.tr
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  onClick={() => setSelectedIncident(selectedId === incident.id ? null : incident.id)}
                  className={`border-b border-[var(--border-subtle)] cursor-pointer transition-colors hover:bg-[var(--bg-hover)] ${selectedId === incident.id ? 'bg-[var(--bg-elevated)]' : ''}`}
                  style={{ borderLeft: selectedId === incident.id ? '2px solid var(--accent-cyan)' : '2px solid transparent' }}
                >
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--accent-cyan)]">
                    {incident.nercId ? incident.nercId.slice(-8) : incident.id}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
                    {formatDate(incident.date)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[11px] text-[var(--text-secondary)] capitalize">{incident.type}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">{incident.region}</td>
                  <td className="px-3 py-2.5">
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
                    {formatDuration(incident.duration)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
                    {incident.loadImpact > 0 ? `${Math.round(incident.loadImpact).toLocaleString()} MW` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded capitalize"
                      style={{
                        color: STATUS_COLORS[incident.status],
                        background: `${STATUS_COLORS[incident.status]}18`,
                      }}
                    >
                      {incident.status.replace('_', ' ')}
                    </span>
                  </td>
                </motion.tr>
                <AnimatePresence>
                  {selectedId === incident.id && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <IncidentDetail />
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-subtle)] flex-shrink-0">
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {sorted.length} incidents
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-6 h-6 rounded font-mono text-[11px] transition-colors ${i === page ? 'bg-[var(--accent-cyan)] text-[var(--bg-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
