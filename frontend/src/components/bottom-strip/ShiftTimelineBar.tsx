'use client'

import { useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useShiftStore } from '@/stores/shiftStore'
import { useUIStore } from '@/stores/uiStore'
import { formatShiftTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const EVENT_COLORS: Record<string, string> = {
  system: 'var(--text-muted)',
  watt: 'var(--accent-cyan)',
  alarm: 'var(--accent-amber)',
  operator: 'var(--accent-green)',
  note: 'var(--text-secondary)',
  critical: 'var(--accent-red)',
  watch: 'var(--accent-indigo)',
}

export default function ShiftTimelineBar() {
  const events = useShiftStore((s) => s.events)
  const shiftStart = useShiftStore((s) => s.shiftStart)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const scrollRef = useRef<HTMLDivElement>(null)

  const now = Date.now()
  const shiftDuration = now - shiftStart
  const barWidth = Math.max(600, events.length * 80)

  return (
    <TooltipProvider>
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto hide-scrollbar relative"
        style={{ minWidth: 0 }}
      >
        <div className="relative flex items-center h-full" style={{ width: barWidth, minWidth: '100%' }}>
          {/* Timeline line */}
          <div
            className="absolute h-px bg-[var(--border-default)]"
            style={{ left: 12, right: 12, top: '50%' }}
          />

          {/* Events */}
          <AnimatePresence initial={false}>
            {events.map((event, i) => {
              const pct = shiftDuration > 0 ? (event.timestamp - shiftStart) / shiftDuration : i / (events.length || 1)
              const left = 12 + pct * (barWidth - 24)
              const color = EVENT_COLORS[event.type] ?? 'var(--text-muted)'

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 16, scale: 0 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute z-10"
                  style={{ left, transform: 'translateX(-50%)' }}
                >
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div
                          role="button"
                          tabIndex={0}
                          className="w-2 h-2 rounded-full flex-shrink-0 cursor-pointer hover:scale-150 transition-transform"
                          style={{ backgroundColor: color }}
                          onClick={() => setActiveTab('shift-log')}
                          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('shift-log')}
                          aria-label={event.title}
                        />
                      }
                    />
                    <TooltipContent
                      side="top"
                      className="text-xs max-w-[200px] bg-[var(--bg-elevated)] border-[var(--border-default)]"
                    >
                      <p className="font-mono text-[10px] text-[var(--text-muted)]">{formatShiftTime(event.timestamp)}</p>
                      <p className="text-[var(--text-primary)] mt-0.5">{event.title}</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Current time indicator */}
          <div
            className="absolute z-20 w-2.5 h-2.5 rounded-full animate-alarm-pulse"
            style={{
              right: 12,
              backgroundColor: 'var(--accent-cyan)',
              boxShadow: '0 0 8px var(--accent-cyan)',
              transform: 'translateX(50%)',
            }}
            aria-label="Current time"
          />
        </div>
      </div>
    </TooltipProvider>
  )
}
