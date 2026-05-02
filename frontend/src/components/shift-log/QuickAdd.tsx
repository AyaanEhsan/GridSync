'use client'

import { useState } from 'react'
import { Plus, FileText, Eye } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useShiftStore } from '@/stores/shiftStore'

export default function QuickAdd() {
  const [open, setOpen] = useState<'note' | 'decision' | 'watch' | null>(null)
  const [text, setText] = useState('')
  const { addNote, addEvent, addWatch, operatorName } = useShiftStore()

  const handleSubmit = () => {
    if (!text.trim()) return

    if (open === 'note') {
      addNote(text)
    } else if (open === 'decision') {
      addEvent({
        id: `EVT-${Date.now()}`,
        type: 'operator',
        timestamp: Date.now(),
        title: 'Decision logged',
        description: text,
        operatorId: operatorName,
      })
    } else if (open === 'watch') {
      addWatch({
        id: `WCH-${Date.now()}`,
        description: text,
        condition: 'Manual watch',
        createdAt: Date.now(),
        active: true,
        createdBy: operatorName,
      })
    }

    setText('')
    setOpen(null)
  }

  const titles = {
    note: 'Add Note',
    decision: 'Log Decision',
    watch: 'Add Watch Item',
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[var(--border-subtle)] flex-shrink-0">
        <span className="font-mono text-[10px] text-[var(--text-muted)] mr-1">Quick Add:</span>

        {(['note', 'decision', 'watch'] as const).map((type) => {
          const Icon = type === 'note' ? Plus : type === 'decision' ? FileText : Eye
          return (
            <button
              key={type}
              onClick={() => setOpen(type)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors capitalize"
            >
              <Icon className="w-3 h-3" />
              {type === 'note' ? 'Add Note' : type === 'decision' ? 'Log Decision' : 'Add Watch'}
            </button>
          )
        })}
      </div>

      <Sheet open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent
          side="right"
          className="bg-[var(--bg-elevated)] border-l border-[var(--border-default)] w-80"
        >
          <SheetHeader>
            <SheetTitle className="font-mono text-sm text-[var(--text-primary)]">
              {open ? titles[open] : ''}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                open === 'watch'
                  ? 'Describe what to watch (e.g., "Watch TX-NM interchange if wind drops")'
                  : 'Enter details...'
              }
              className="w-full font-mono text-xs bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded p-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent-cyan)]"
              rows={5}
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="flex-1 py-2 rounded font-mono text-xs font-semibold text-[var(--bg-primary)] disabled:opacity-40 transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent-cyan)' }}
              >
                Save
              </button>
              <button
                onClick={() => { setOpen(null); setText('') }}
                className="px-3 py-2 rounded font-mono text-xs text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
