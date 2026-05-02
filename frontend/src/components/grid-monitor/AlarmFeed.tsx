'use client'

import { memo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, BellOff } from 'lucide-react'
import { useGridStore } from '@/stores/gridStore'
import { useCopilotStore } from '@/stores/copilotStore'
import SeverityBadge from '@/components/shared/SeverityBadge'
import { formatTimestamp } from '@/lib/formatters'
import type { Alarm } from '@/lib/types'

interface AlarmItemProps {
  alarm: Alarm
  onDismiss: (id: string) => void
  onClick: (alarm: Alarm) => void
}

const AlarmItem = memo(function AlarmItem({ alarm, onDismiss, onClick }: AlarmItemProps) {
  const isCritical = alarm.severity === 'critical'
  const borderColor = isCritical ? 'var(--accent-red)' : alarm.severity === 'major' ? 'var(--accent-amber)' : 'var(--border-default)'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0, y: -16 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.25 }}
      className={`mx-2 mb-1.5 p-2.5 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)] ${isCritical ? 'animate-alarm-pulse' : ''}`}
      style={{
        borderLeft: `2px solid ${borderColor}`,
        backgroundColor: alarm.acknowledged ? 'transparent' : `${borderColor}10`,
      }}
      onClick={() => onClick(alarm)}
      role="listitem"
      aria-label={`${alarm.severity} alarm: ${alarm.description}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <SeverityBadge severity={alarm.severity} showLabel={false} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] text-[var(--text-secondary)] leading-snug">
            {alarm.description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] text-[var(--text-muted)]">{alarm.region}</span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {formatTimestamp(alarm.timestamp, 'HH:mm:ss')}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(alarm.id) }}
          className="flex-shrink-0 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Acknowledge alarm"
        >
          {alarm.acknowledged ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
        </button>
      </div>
    </motion.div>
  )
})

export default function AlarmFeed() {
  const alarms = useGridStore((s) => s.alarms)
  const acknowledgeAlarm = useGridStore((s) => s.acknowledgeAlarm)
  const addMessage = useCopilotStore((s) => s.addMessage)
  const setAgentStatus = useCopilotStore((s) => s.setAgentStatus)

  const handleAlarmClick = (alarm: Alarm) => {
    addMessage({
      id: `msg-${Date.now()}`,
      type: 'alert',
      timestamp: Date.now(),
      content: `Alarm context: ${alarm.description} in ${alarm.region} (${alarm.severity})`,
      alertSeverity: alarm.severity === 'critical' ? 'critical' : 'warning',
    })
    setAgentStatus('analyzing')
  }

  return (
    <div
      className="h-full flex flex-col min-h-0"
      role="log"
      aria-live="polite"
      aria-label="Active alarms"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          Active Alarms
        </span>
        <span className="font-jetbrains text-xs font-bold text-[var(--accent-red)]">
          {alarms.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pt-1 min-h-0">
        {alarms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-muted)]">
            <BellOff className="w-6 h-6 opacity-40" />
            <span className="font-mono text-xs">No active alarms</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {alarms.map((alarm) => (
              <AlarmItem
                key={alarm.id}
                alarm={alarm}
                onDismiss={acknowledgeAlarm}
                onClick={handleAlarmClick}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
