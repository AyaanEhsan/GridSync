'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts'

const DATA = [
  { name: 'Correct',  value: 89, color: 'var(--accent-green)' },
  { name: 'Modified', value: 8,  color: 'var(--accent-amber)' },
  { name: 'Rejected', value: 3,  color: 'var(--accent-red)' },
]

function CenterLabel({ viewBox }: any) {
  const { cx, cy } = viewBox ?? {}
  if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) return null
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
        fontSize={22} fontWeight="700" fill="var(--accent-green)" fontFamily="IBM Plex Mono">
        89%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle"
        fontSize={9} fill="var(--text-muted)" fontFamily="IBM Plex Mono">
        correct
      </text>
    </g>
  )
}

export default function WATTAccuracy() {
  return (
    <div className="flex flex-col items-center" style={{ height: 160 }}>
      <div style={{ width: '100%', height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={DATA}
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={-270}
              innerRadius={42}
              outerRadius={58}
              paddingAngle={2}
              dataKey="value"
            >
              {DATA.map((entry, i) => (
                <Cell key={i} fill={entry.color} opacity={0.85} />
              ))}
              <Label content={<CenterLabel />} position="center" />
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                fontFamily: 'IBM Plex Mono',
                fontSize: 11,
                borderRadius: 4,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-1">
        {DATA.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="font-ibm-mono text-[10px] text-[var(--text-secondary)]">
              {d.name} {d.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
