'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useIncidentStore } from '@/stores/incidentStore'
import type { IncidentSeverity, IncidentType } from '@/lib/types'

interface AddIncidentModalProps {
  open: boolean
  onClose: () => void
}

export default function AddIncidentModal({ open, onClose }: AddIncidentModalProps) {
  const addIncident = useIncidentStore((s) => s.addIncident)
  const [form, setForm] = useState({
    type: 'frequency' as IncidentType,
    severity: 'major' as IncidentSeverity,
    region: 'CAISO',
    loadImpact: '',
    description: '',
    actionsTaken: '',
    outcome: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!form.description.trim()) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))

    addIncident({
      id: `INC-${Date.now()}`,
      date: Date.now(),
      type: form.type,
      severity: form.severity,
      region: form.region,
      duration: 0,
      loadImpact: parseFloat(form.loadImpact) || 0,
      status: 'active',
      narrative: form.description,
      actionsTaken: form.actionsTaken
        ? [{ timestamp: Date.now(), action: form.actionsTaken }]
        : [],
      outcome: form.outcome,
    })

    setSubmitting(false)
    onClose()
    setForm({ type: 'frequency', severity: 'major', region: 'CAISO', loadImpact: '', description: '', actionsTaken: '', outcome: '' })
  }

  const fieldClass = "w-full h-8 font-mono text-xs bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-0"
  const labelClass = "block font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm text-[var(--text-primary)]">Log New Incident</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as IncidentType })}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] font-mono text-xs">
                  {['frequency', 'voltage', 'overload', 'weather', 'cyber', 'renewable', 'cascading', 'datacenter'].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelClass}>Severity</label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as IncidentSeverity })}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] font-mono text-xs">
                  {['critical', 'major', 'minor', 'info'].map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Region/BA</label>
              <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v ?? form.region })}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] font-mono text-xs">
                  {['CAISO', 'ERCOT', 'PJM', 'MISO', 'SPP', 'NYISO', 'ISONE', 'WECC'].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelClass}>Load Impact (MW)</label>
              <Input
                type="number"
                value={form.loadImpact}
                onChange={(e) => setForm({ ...form, loadImpact: e.target.value })}
                placeholder="e.g. 1200"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description / Narrative</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what happened..."
              className="w-full font-mono text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded p-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent-cyan)]"
              rows={3}
            />
          </div>

          <div>
            <label className={labelClass}>Actions Taken</label>
            <textarea
              value={form.actionsTaken}
              onChange={(e) => setForm({ ...form, actionsTaken: e.target.value })}
              placeholder="What actions were taken?"
              className="w-full font-mono text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded p-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent-cyan)]"
              rows={2}
            />
          </div>

          <div>
            <label className={labelClass}>Outcome</label>
            <textarea
              value={form.outcome}
              onChange={(e) => setForm({ ...form, outcome: e.target.value })}
              placeholder="What was the result?"
              className="w-full font-mono text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded p-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent-cyan)]"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="font-mono text-xs border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !form.description.trim()}
              className="font-mono text-xs"
              style={{ background: 'var(--accent-cyan)', color: 'var(--bg-primary)' }}
            >
              {submitting ? 'Logging...' : 'Log Incident'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
