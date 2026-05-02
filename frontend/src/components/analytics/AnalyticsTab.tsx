'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import GlassCard from '@/components/shared/GlassCard'
import GridHealthScore from './GridHealthScore'
import WATTAccuracy from './WATTAccuracy'
import { useGridStore } from '@/stores/gridStore'
import ResponseTime from './ResponseTime'
import IncidentFrequency from './IncidentFrequency'
import DecisionSummary from './DecisionSummary'

const DATE_RANGES = ['Last 24h', '7d', '30d', '90d'] as const

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

export default function AnalyticsTab() {
  const [range, setRange] = useState<string>('7d')
  // LIVE_MODE_HIDDEN — Grid Health Score has no live API source.
  const demoMode = useGridStore((s) => s.demoMode)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col h-full overflow-auto p-3 gap-3"
    >
      {/* Date range selector */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 flex-shrink-0">
        <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wide mr-1">Range:</span>
        {DATE_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className="px-2.5 py-1 rounded font-mono text-[11px] transition-colors"
            style={{
              backgroundColor: range === r ? 'var(--accent-cyan)' : 'var(--bg-elevated)',
              color: range === r ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}
          >
            {r}
          </button>
        ))}
      </motion.div>

      {/* Row 1: Health Score (demo-only) + WATT Accuracy */}
      <motion.div
        variants={itemVariants}
        className={demoMode ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}
        style={{ height: 200 }}
      >
        {demoMode && (
          <GlassCard className="flex flex-col" noPadding>
            <div className="px-3 pt-2.5 pb-1 border-b border-[var(--border-subtle)]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Grid Health · Demo</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <GridHealthScore />
            </div>
          </GlassCard>
        )}
        <GlassCard className="flex flex-col" noPadding>
          <div className="px-3 pt-2.5 pb-1 border-b border-[var(--border-subtle)]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">WATT Accuracy</span>
          </div>
          <WATTAccuracy />
        </GlassCard>
      </motion.div>

      {/* Row 2: Response time */}
      <motion.div variants={itemVariants} style={{ height: 180 }}>
        <GlassCard className="h-full flex flex-col" noPadding>
          <div className="px-3 pt-2.5 pb-1 border-b border-[var(--border-subtle)]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              Response Time — Alarm → Action (minutes)
            </span>
          </div>
          <div style={{ height: 130 }}>
            <ResponseTime />
          </div>
        </GlassCard>
      </motion.div>

      {/* Row 3: Incident frequency + Decision log */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3" style={{ height: 200 }}>
        <GlassCard className="flex flex-col" noPadding>
          <div className="px-3 pt-2.5 pb-1 border-b border-[var(--border-subtle)]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Incident Frequency by Type</span>
          </div>
          <div style={{ height: 150 }}>
            <IncidentFrequency />
          </div>
        </GlassCard>
        <GlassCard className="flex flex-col" noPadding>
          <div className="px-3 pt-2.5 pb-1 border-b border-[var(--border-subtle)]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Operator Decision Log</span>
          </div>
          <div className="flex-1 min-h-0">
            <DecisionSummary />
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
