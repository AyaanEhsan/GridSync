'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { MOCK_PLAYBOOKS } from '@/lib/mock-data/playbookData'
import CategoryCards from './CategoryCards'
import PlaybookList from './PlaybookList'
import PlaybookDetail from './PlaybookDetail'
import type { PlaybookCategory } from '@/lib/types'

export default function PlaybookTab() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<PlaybookCategory | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return MOCK_PLAYBOOKS.filter((pb) => {
      if (selectedCategory && pb.category !== selectedCategory) return false
      if (search) {
        const q = search.toLowerCase()
        if (!pb.title.toLowerCase().includes(q) && !pb.tags.some((t) => t.includes(q))) return false
      }
      return true
    })
  }, [search, selectedCategory])

  const selectedPlaybook = MOCK_PLAYBOOKS.find((p) => p.id === selectedId)

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)]">
      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search playbooks... e.g. "frequency excursion"'
            className="pl-7 h-8 font-mono text-xs bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-0"
          />
        </div>
      </div>

      {/* Category filter */}
      <CategoryCards selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div
          className={`${selectedPlaybook ? 'w-64 border-r border-[var(--border-subtle)]' : 'flex-1'} overflow-y-auto`}
        >
          <PlaybookList
            playbooks={filtered}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
          />
        </div>

        {selectedPlaybook && (
          <div className="flex-1 flex flex-col min-h-0">
            <PlaybookDetail playbook={selectedPlaybook} />
          </div>
        )}
      </div>
    </div>
  )
}
