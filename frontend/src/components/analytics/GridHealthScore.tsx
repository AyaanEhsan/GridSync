'use client'

import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'

const SCORE = 91

export default function GridHealthScore() {
  const scoreColor =
    SCORE >= 70 ? 'var(--accent-green)'
    : SCORE >= 40 ? 'var(--accent-amber)'
    : 'var(--accent-red)'

  const data = [{ value: SCORE, fill: scoreColor }]

  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`Grid health score: ${SCORE} out of 100`}
    >
      <div className="relative" style={{ width: 160, height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            startAngle={180}
            endAngle={0}
            innerRadius="58%"
            outerRadius="80%"
            data={data}
            barSize={14}
          >
            <RadialBar
              dataKey="value"
              background={{ fill: 'var(--bg-elevated)' }}
              cornerRadius={4}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Overlay labels */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
          <span
            className="font-ibm-mono text-2xl font-semibold leading-none"
            style={{ color: scoreColor }}
          >
            {SCORE}
          </span>
          <span className="font-ibm-mono text-[9px] text-[var(--text-muted)] mt-0.5">
            / 100
          </span>
        </div>
      </div>
      <p className="font-ibm-mono text-[10px] text-[var(--text-muted)] mt-1">
        Grid Health Score
      </p>
    </div>
  )
}
