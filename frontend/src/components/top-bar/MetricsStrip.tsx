'use client'

import { useMemo, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useGridStore } from '@/stores/gridStore'
import MetricChip from './MetricChip'
import ThemeToggle from '@/components/shared/ThemeToggle'
import DataStatusChip from '@/components/shared/DataStatusChip'
import {
  formatFrequency, formatMW, formatDeviation,
  getFrequencyZone,
} from '@/lib/formatters'
import { GRID_STATE_COLORS } from '@/lib/constants'

export default function MetricsStrip() {
  const metrics = useGridStore((s) => s.metrics)
  const frequencyHistory = useGridStore((s) => s.frequencyHistory)
  const loadSparkline = useGridStore((s) => s.loadSparkline)
  const dcLoadSparkline = useGridStore((s) => s.dcLoadSparkline)
  const gridState = useGridStore((s) => s.gridState)
  const demoMode = useGridStore((s) => s.demoMode)

  const freqZone = getFrequencyZone(metrics.frequency)
  const freqColor = freqZone === 'nominal'
    ? 'var(--accent-cyan)'
    : freqZone === 'watch'
    ? 'var(--accent-amber)'
    : 'var(--accent-red)'

  const freqDeviation = metrics.frequency - 60.0
  const freqTrend = frequencyHistory.length >= 2
    ? frequencyHistory[frequencyHistory.length - 1]?.value > frequencyHistory[frequencyHistory.length - 2]?.value
      ? 'up'
      : 'down'
    : 'stable'

  const loadTrend = loadSparkline.length >= 2
    ? loadSparkline[loadSparkline.length - 1]?.value > loadSparkline[loadSparkline.length - 2]?.value
      ? 'up'
      : 'down'
    : 'stable'

  const forecastColor = Math.abs(metrics.forecastDeviation) < 3
    ? 'var(--accent-green)'
    : Math.abs(metrics.forecastDeviation) < 5
    ? 'var(--accent-amber)'
    : 'var(--accent-red)'

  const dcLoadColor = metrics.dcLoad > 1200
    ? 'var(--accent-red)'
    : metrics.dcLoad > 800
    ? 'var(--accent-amber)'
    : 'var(--text-secondary)'

  const [shiftTime, setShiftTime] = useState('--:--:-- -- · --')
  useEffect(() => {
    const update = () => {
      const now = new Date()
      const h = now.getHours()
      const shiftLabel = h >= 22 || h < 6 ? 'Night Shift' : h < 14 ? 'Day Shift' : 'Evening Shift'
      setShiftTime(`${format(now, 'hh:mm:ss a')} · ${shiftLabel}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const bgStyle = gridState === 'nominal'
    ? {}
    : {
        background: `linear-gradient(90deg, ${GRID_STATE_COLORS[gridState]}08 0%, transparent 100%)`,
      }

  return (
    <div
      className="flex items-center h-12 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex-shrink-0 overflow-x-auto hide-scrollbar transition-all duration-1000"
      style={bgStyle}
      aria-label="Live grid metrics"
    >
      {/* LIVE_MODE_HIDDEN — frequency has no live API source. Bring back when available. */}
      {demoMode && (
        <MetricChip
          label="FREQ"
          value={formatFrequency(metrics.frequency)}
          color={freqColor}
          sparklineData={frequencyHistory}
          trend={freqTrend}
          trendColor={freqColor}
          pulse
          aria-label={`Grid frequency: ${formatFrequency(metrics.frequency)}, deviation ${freqDeviation > 0 ? '+' : ''}${freqDeviation.toFixed(4)} Hz`}
        />
      )}

      <MetricChip
        label="LOAD"
        value={metrics.load > 0 ? formatMW(Math.round(metrics.load)) : '—'}
        color="var(--accent-cyan)"
        sparklineData={loadSparkline}
        trend={loadTrend}
      />

      {/* LIVE_MODE_HIDDEN — load forecast deviation has no live API source. */}
      {demoMode && (
        <MetricChip
          label="Δ FORECAST"
          value={formatDeviation(metrics.forecastDeviation)}
          color={forecastColor}
          trend={metrics.forecastDeviation > 0 ? 'up' : 'down'}
          trendColor={forecastColor}
        />
      )}

      {/* LIVE_MODE_HIDDEN — alarm feed has no live API source. */}
      {demoMode && (
        <MetricChip
          label="ALARMS"
          value={String(metrics.alarmCount)}
          color={metrics.alarmCount > 0 ? 'var(--accent-red)' : 'var(--text-secondary)'}
          badge={metrics.alarmCount}
          trend="stable"
        />
      )}

      {/* LIVE_MODE_HIDDEN — DC load has no live API source. */}
      {demoMode && (
        <MetricChip
          label="DC LOAD"
          value={formatMW(Math.round(metrics.dcLoad))}
          color={dcLoadColor}
          sparklineData={dcLoadSparkline}
          trend="stable"
        />
      )}

      <MetricChip
        label="SHIFT"
        value={shiftTime}
        color="var(--text-secondary)"
        trend="stable"
      />

      <div className="flex-1" />
      <div className="flex items-center gap-3 px-3 border-l border-[var(--border-subtle)]">
        <DataStatusChip />
        <ThemeToggle />
      </div>
    </div>
  )
}
