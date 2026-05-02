'use client'

import { useState } from 'react'
import type { EscalationOption } from '@/lib/types'

interface EscalationQuestionProps {
  messageId: string
  content: string
  options: EscalationOption[]
  selectedOption?: string
}

export default function EscalationQuestion({ messageId, content, options, selectedOption: initialSelected }: EscalationQuestionProps) {
  const [selected, setSelected] = useState<string | undefined>(initialSelected)

  return (
    <div className="mx-3 my-2 p-3 rounded border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.06)]">
      <p className="font-mono text-xs text-[var(--text-primary)] leading-relaxed mb-3">{content}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isSelected = selected === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className="font-mono text-[11px] h-7 px-2.5 rounded border transition-colors"
              style={{
                backgroundColor: isSelected ? 'var(--accent-cyan)' : 'transparent',
                borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-default)',
                color: isSelected ? 'var(--bg-primary)' : 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
