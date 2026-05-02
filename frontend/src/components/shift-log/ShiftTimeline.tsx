'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Check } from 'lucide-react'
import { useShiftStore } from '@/stores/shiftStore'
import { formatShiftTime } from '@/lib/formatters'

const TYPE_COLORS: Record<string, string> = {
  system: 'var(--text-muted)',
  watt: 'var(--accent-cyan)',
  alarm: 'var(--accent-amber)',
  operator: 'var(--accent-green)',
  note: 'var(--text-secondary)',
  critical: 'var(--accent-red)',
  watch: 'var(--accent-indigo)',
}

export default function ShiftTimeline() {
  const events = useShiftStore((s) => s.events)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
      <div className="relative pl-6">
        {/* Connecting line */}
        <div className="absolute left-2 top-2 bottom-2 w-px bg-[var(--border-default)]" />

        <AnimatePresence initial={false}>
          {events.map((event, idx) => {
            const color = TYPE_COLORS[event.type] ?? 'var(--text-muted)'
            const isExpanded = expandedId === event.id

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                className="relative mb-4"
              >
                {/* Dot */}
                <div
                  className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full border-2 flex-shrink-0"
                  style={{
                    backgroundColor: color + '33',
                    borderColor: color,
                  }}
                />

                {/* Card */}
                <div
                  className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  <div className="flex items-start justify-between px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {formatShiftTime(event.timestamp)}
                        </span>
                        {event.approved && (
                          <span className="flex items-center gap-0.5 font-mono text-[10px] text-[var(--accent-green)]">
                            <Check className="w-2.5 h-2.5" />
                            Approved
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs font-semibold text-[var(--text-primary)] leading-snug">
                        {event.title}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 flex-shrink-0 ml-2 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-[var(--border-subtle)] pt-2">
                          <p className="font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed">
                            {event.description}
                          </p>
                          {event.operatorId && (
                            <p className="font-mono text-[10px] text-[var(--text-muted)] mt-1.5">
                              — {event.operatorId}
                              {event.approvedAt && ` at ${formatShiftTime(event.approvedAt)}`}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
