'use client'

const DATA = [
  { date: '2026-04-25', shift: 'Night', operator: 'Maria K.', total: 8, approved: 6, modified: 1, rejected: 1, avgResponse: '1m 42s' },
  { date: '2026-04-25', shift: 'Evening', operator: 'James T.', total: 5, approved: 4, modified: 1, rejected: 0, avgResponse: '2m 08s' },
  { date: '2026-04-24', shift: 'Night', operator: 'Alex R.', total: 11, approved: 9, modified: 2, rejected: 0, avgResponse: '1m 55s' },
  { date: '2026-04-24', shift: 'Day', operator: 'Sam W.', total: 3, approved: 3, modified: 0, rejected: 0, avgResponse: '3m 12s' },
]

export default function DecisionSummary() {
  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            {['Date', 'Shift', 'Operator', 'Total', 'Approved', 'Modified', 'Rejected', 'Avg Response'].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DATA.map((row, i) => (
            <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
              <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-muted)]">{row.date}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">{row.shift}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">{row.operator}</td>
              <td className="px-3 py-2 font-mono text-[11px] font-bold text-[var(--text-primary)]">{row.total}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-[var(--accent-green)]">{row.approved}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-[var(--accent-amber)]">{row.modified}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-[var(--accent-red)]">{row.rejected}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-[var(--accent-cyan)]">{row.avgResponse}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
