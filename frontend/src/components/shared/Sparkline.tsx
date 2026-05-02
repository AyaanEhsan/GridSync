'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { SparklinePoint } from '@/lib/types'

interface SparklineProps {
  data: SparklinePoint[]
  color?: string
  width?: number
  height?: number
}

export default function Sparkline({ data, color = 'var(--accent-cyan)', width = 60, height = 24 }: SparklineProps) {
  if (!data || data.length === 0) return null

  return (
    <div style={{ width, height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
