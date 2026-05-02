'use client'

import ShiftHeader from './ShiftHeader'
import ShiftTimeline from './ShiftTimeline'
import QuickAdd from './QuickAdd'

export default function ShiftLogTab() {
  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)]">
      <ShiftHeader />
      <ShiftTimeline />
      <QuickAdd />
    </div>
  )
}
