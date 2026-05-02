'use client'

import { Download, FileText } from 'lucide-react'
import { useShiftStore } from '@/stores/shiftStore'
import { formatDuration, formatTimestamp } from '@/lib/formatters'

export default function ShiftHeader() {
  const { shiftStart, operatorName, events } = useShiftStore()

  const elapsed = Math.floor((Date.now() - shiftStart) / 1000)

  const handleExport = () => {
    const data = JSON.stringify(events, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shift-log-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-start justify-between flex-shrink-0">
      <div>
        <h2 className="font-mono text-sm font-bold text-[var(--text-primary)]">Night Shift</h2>
        <p className="font-mono text-[11px] text-[var(--text-muted)] mt-0.5">
          Started {formatTimestamp(shiftStart, 'hh:mm a')} · Operator: {operatorName} · Elapsed: {formatDuration(elapsed)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono text-[11px] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export Log
        </button>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono text-[11px] font-semibold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))' }}
        >
          <FileText className="w-3.5 h-3.5" />
          Generate Brief
        </button>
      </div>
    </div>
  )
}
