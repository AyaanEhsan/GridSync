'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const DATA = [
  { month: 'Sep', frequency: 3, voltage: 1, overload: 2, weather: 0, renewable: 1 },
  { month: 'Oct', frequency: 1, voltage: 2, overload: 1, weather: 1, renewable: 2 },
  { month: 'Nov', frequency: 2, voltage: 1, overload: 3, weather: 2, renewable: 1 },
  { month: 'Dec', frequency: 4, voltage: 0, overload: 2, weather: 3, renewable: 0 },
  { month: 'Jan', frequency: 2, voltage: 1, overload: 1, weather: 4, renewable: 0 },
  { month: 'Feb', frequency: 1, voltage: 2, overload: 2, weather: 2, renewable: 1 },
]

const COLORS: Record<string, string> = {
  frequency: '#00F0FF', voltage: '#6366F1', overload: '#FF6B35', weather: '#F0BB40', renewable: '#00E676',
}

export default function IncidentFrequency() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={DATA} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={20} />
        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
        {Object.entries(COLORS).map(([key, color]) => (
          <Bar key={key} dataKey={key} stackId="a" fill={color} opacity={0.8} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
