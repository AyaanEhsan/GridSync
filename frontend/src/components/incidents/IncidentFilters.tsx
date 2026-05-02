'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Plus } from 'lucide-react'
import { useIncidentStore } from '@/stores/incidentStore'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import AddIncidentModal from './AddIncidentModal'

export default function IncidentFilters() {
  const filters = useIncidentStore((s) => s.filters)
  const setFilters = useIncidentStore((s) => s.setFilters)
  const [addOpen, setAddOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(filters.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilters({ search: searchInput })
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput]) // eslint-disable-line

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search incidents..."
          className="pl-7 h-8 font-mono text-xs bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-0"
        />
      </div>

      <Select value={filters.severity ?? ''} onValueChange={(v) => setFilters({ severity: v as any || undefined })}>
        <SelectTrigger className="w-28 h-8 font-mono text-xs bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)]">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] font-mono text-xs">
          <SelectItem value=" ">All</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="major">Major</SelectItem>
          <SelectItem value="minor">Minor</SelectItem>
          <SelectItem value="info">Info</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.type ?? ''} onValueChange={(v) => setFilters({ type: v as any || undefined })}>
        <SelectTrigger className="w-32 h-8 font-mono text-xs bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)]">
          <SelectValue placeholder="Event Type" />
        </SelectTrigger>
        <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] font-mono text-xs">
          <SelectItem value=" ">All Types</SelectItem>
          <SelectItem value="frequency">Frequency</SelectItem>
          <SelectItem value="voltage">Voltage</SelectItem>
          <SelectItem value="overload">Overload</SelectItem>
          <SelectItem value="weather">Weather</SelectItem>
          <SelectItem value="cyber">Cyber</SelectItem>
          <SelectItem value="renewable">Renewable</SelectItem>
          <SelectItem value="cascading">Cascading</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1" />

      <Button
        size="sm"
        onClick={() => setAddOpen(true)}
        className="h-8 font-mono text-xs gap-1.5"
        style={{ background: 'var(--accent-cyan)', color: 'var(--bg-primary)' }}
      >
        <Plus className="w-3.5 h-3.5" />
        Add Incident
      </Button>

      <AddIncidentModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
