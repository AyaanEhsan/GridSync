'use client'

import { motion } from 'motion/react'
import GlassCard from '@/components/shared/GlassCard'
import AlarmFeed from './AlarmFeed'
import WeatherOverlay from './WeatherOverlay'
import LoadCurve from './LoadCurve'
import FrequencyGauge from './FrequencyGauge'
import RegionalTreemap from './RegionalTreemap'
import { useGridStore } from '@/stores/gridStore'

// Outer layout uses flex-col + proportional flex-grow so each row gets a
// definite height regardless of the ancestor chain (react-resizable-panels
// uses flex internally; CSS Grid fr units require a definite container height
// which can fail to resolve through nested flex items).
//
// Row proportions: 35 / 20 / 45 → same visual split as before.

export default function GridMonitorTab() {
  const demoMode = useGridStore((s) => s.demoMode)
  const showAlarms = demoMode

  return (
    <div className="h-full flex flex-col overflow-hidden p-3 gap-3">

      {/* ── Row 1 (33%): Frequency gauge + Load curve ── */}
      <div className="flex gap-3 overflow-hidden" style={{ flex: '33 1 0%' }}>

        {/* Frequency gauge */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <GlassCard className="h-full flex flex-col" noPadding>
            <div className="px-3 pt-2.5 pb-1 flex-shrink-0 border-b border-[var(--border-subtle)]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                {demoMode ? 'Frequency · Incident Sim' : 'Frequency · ERCOT'}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
              <FrequencyGauge />
            </div>
          </GlassCard>
        </div>

        {/* Load curve */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <GlassCard className="h-full flex flex-col" noPadding>
            <div className="px-3 pt-2.5 pb-1 flex-shrink-0 border-b border-[var(--border-subtle)]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                ERCOT Load Curve (6hr)
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <LoadCurve />
            </div>
          </GlassCard>
        </div>

      </div>

      {/* ── Row 2 (22%): Regional LMP ── */}
      <div className="overflow-hidden" style={{ flex: '28 1 0%' }}>
        <GlassCard className="h-full flex flex-col" noPadding>
          <div className="px-3 pt-2.5 pb-1 flex-shrink-0 border-b border-[var(--border-subtle)]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              ERCOT / PJM Realtime LMP
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <RegionalTreemap />
          </div>
        </GlassCard>
      </div>

      {/* ── Row 3 (45%): Weather overlay (+ Alarm feed in demo mode) ── */}
      <div className="flex gap-3 overflow-hidden min-h-0" style={{ flex: '39 1 0%' }}>

        {showAlarms && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <GlassCard className="h-full overflow-hidden" noPadding>
              <AlarmFeed />
            </GlassCard>
          </div>
        )}

        <div className="min-w-0 min-h-0 overflow-hidden" style={{ flex: showAlarms ? '1 1 0%' : '1 1 100%' }}>
          <GlassCard className="h-full flex flex-col" noPadding>
            <div className="px-3 pt-2.5 pb-1 flex-shrink-0 border-b border-[var(--border-subtle)]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Weather (Austin · ERCOT)
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <WeatherOverlay />
            </div>
          </GlassCard>
        </div>

      </div>

    </div>
  )
}
