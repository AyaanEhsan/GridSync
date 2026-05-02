'use client'

import { useMemo, useState, useEffect } from 'react'
import { useGridStore } from '@/stores/gridStore'
import { getFrequencyZone } from '@/lib/formatters'
import {
  FREQUENCY_DISPLAY_MIN, FREQUENCY_DISPLAY_MAX,
  FREQUENCY_WARN_LOW, FREQUENCY_WARN_HIGH,
  FREQUENCY_CRIT_LOW, FREQUENCY_CRIT_HIGH,
} from '@/lib/constants'

const W = 280
const H = 180
const CX = W / 2
const CY = H - 28
const R_OUTER = 106
const R_INNER = 72

// Gauge sweep: -225° to +45° (270° total, classic speedometer)
const START_DEG = -225
const END_DEG = 45
const RANGE_DEG = END_DEG - START_DEG

function hzToDeg(hz: number): number {
  const t = (hz - FREQUENCY_DISPLAY_MIN) / (FREQUENCY_DISPLAY_MAX - FREQUENCY_DISPLAY_MIN)
  return START_DEG + t * RANGE_DEG
}

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, rInner: number, rOuter: number, startDeg: number, endDeg: number) {
  const s1 = polarXY(cx, cy, rOuter, startDeg)
  const e1 = polarXY(cx, cy, rOuter, endDeg)
  const s2 = polarXY(cx, cy, rInner, endDeg)
  const e2 = polarXY(cx, cy, rInner, startDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${s1.x} ${s1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${e2.x} ${e2.y}`,
    'Z',
  ].join(' ')
}

const ZONE_ARCS = [
  { from: FREQUENCY_DISPLAY_MIN, to: FREQUENCY_CRIT_LOW,  color: 'var(--accent-red)' },
  { from: FREQUENCY_CRIT_LOW,    to: FREQUENCY_WARN_LOW,  color: 'var(--accent-amber)' },
  { from: FREQUENCY_WARN_LOW,    to: FREQUENCY_WARN_HIGH, color: 'var(--accent-green)' },
  { from: FREQUENCY_WARN_HIGH,   to: FREQUENCY_CRIT_HIGH, color: 'var(--accent-amber)' },
  { from: FREQUENCY_CRIT_HIGH,   to: FREQUENCY_DISPLAY_MAX, color: 'var(--accent-red)' },
]

const TICK_VALUES = [59.85, 59.9, 59.95, 60.0, 60.05, 60.1, 60.15]

export default function FrequencyGauge() {
  const demoMode = useGridStore((s) => s.demoMode)
  const storeFrequency = useGridStore((s) => s.metrics.frequency)

  // In live mode: gentle ±0.035 Hz nominal oscillation (20-second period).
  // Stays entirely within green zone (59.965–60.035 Hz). No API source exists
  // for ERCOT frequency — this keeps the gauge alive without fabricating data.
  const [nominalFreq, setNominalFreq] = useState(60.0)
  useEffect(() => {
    if (demoMode) return
    let t = 0
    const id = setInterval(() => {
      t += 0.2 // 200ms tick → full 20s period at 2π/100 steps
      setNominalFreq(60.0 + 0.035 * Math.sin((t * 2 * Math.PI) / 100))
    }, 200)
    return () => clearInterval(id)
  }, [demoMode])

  const rawFreq = demoMode ? storeFrequency : nominalFreq
  const safeFreq = isNaN(rawFreq) ? 60.0 : rawFreq
  const zone = getFrequencyZone(safeFreq)

  const zoneColor = zone === 'nominal'
    ? 'var(--accent-green)'
    : zone === 'watch'
    ? 'var(--accent-amber)'
    : 'var(--accent-red)'

  const needleDeg = hzToDeg(Math.max(FREQUENCY_DISPLAY_MIN, Math.min(FREQUENCY_DISPLAY_MAX, safeFreq)))
  const deviation = safeFreq - 60.0
  const devText = `Δ ${deviation >= 0 ? '+' : ''}${deviation.toFixed(3)} Hz`

  const zoneArcs = useMemo(() =>
    ZONE_ARCS.map((z) => ({
      ...z,
      path: arcPath(CX, CY, R_INNER + 2, R_OUTER, hzToDeg(z.from), hzToDeg(z.to)),
    })),
    []
  )

  return (
    <div className="flex flex-col items-center w-full gap-0.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[280px]"
        role="img"
        aria-label={`Frequency gauge: ${safeFreq.toFixed(2)} Hz, ${zone}`}
      >
        {/* Background track */}
        <path
          d={arcPath(CX, CY, R_INNER + 2, R_OUTER, START_DEG, END_DEG)}
          fill="var(--bg-elevated)"
        />

        {/* Zone arcs */}
        {zoneArcs.map((z, i) => (
          <path key={i} d={z.path} fill={z.color} opacity={0.55} />
        ))}

        {/* Tick marks */}
        {TICK_VALUES.map((v) => {
          const deg = hzToDeg(v)
          const inner = polarXY(CX, CY, R_OUTER + 5, deg)
          const outer = polarXY(CX, CY, R_OUTER + 12, deg)
          const isCenter = v === 60.0
          return (
            <line
              key={v}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke={isCenter ? 'var(--text-primary)' : 'var(--text-muted)'}
              strokeWidth={isCenter ? 1.5 : 0.75}
              opacity={isCenter ? 0.8 : 0.5}
            />
          )
        })}

        {/* Needle */}
        <g
          style={{
            transform: `rotate(${needleDeg + 90}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transformBox: 'view-box',
            transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <line
            x1={CX} y1={CY + 10}
            x2={CX} y2={CY - (R_INNER - 6)}
            stroke={zoneColor}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={7} fill="var(--bg-primary)" stroke={zoneColor} strokeWidth={1.5} />

        {/* Value display */}
        <text
          x={CX} y={CY - 22}
          textAnchor="middle"
          fontSize={24}
          fontWeight="600"
          fill={zoneColor}
          fontFamily="IBM Plex Mono, monospace"
          className="animate-pulse-glow"
        >
          {safeFreq.toFixed(2)} Hz
        </text>
        <text
          x={CX} y={CY - 6}
          textAnchor="middle"
          fontSize={10}
          fill="var(--text-muted)"
          fontFamily="IBM Plex Mono, monospace"
        >
          {devText}
        </text>
      </svg>
      {!demoMode && (
        <p
          className="font-mono text-[9px] text-center leading-none opacity-40"
          style={{ color: 'var(--text-muted)' }}
        >
          NOMINAL · NO LIVE FEED
        </p>
      )}
    </div>
  )
}
