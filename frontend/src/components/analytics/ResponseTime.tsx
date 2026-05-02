'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts'

const DATA = [
  { shift: 'Mon D', withWATT: 2.1, baseline: 6.4 },
  { shift: 'Mon N', withWATT: 1.8, baseline: 7.1 },
  { shift: 'Tue D', withWATT: 2.4, baseline: 5.9 },
  { shift: 'Tue N', withWATT: 1.6, baseline: 6.8 },
  { shift: 'Wed D', withWATT: 2.0, baseline: 6.2 },
  { shift: 'Wed N', withWATT: 1.9, baseline: 7.3 },
  { shift: 'Thu D', withWATT: 1.7, baseline: 6.0 },
]

export default function ResponseTime() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={DATA} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="shift" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={24} unit="m" />
        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
        <ReferenceArea x1="Mon D" x2="Thu D" y1={0} y2={3} fill="rgba(0,230,118,0.05)" />
        <Line type="monotone" dataKey="withWATT" name="With WATT" stroke="#00E676" strokeWidth={2} dot={{ fill: '#00E676', r: 3 }} />
        <Line type="monotone" dataKey="baseline" name="Baseline" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
