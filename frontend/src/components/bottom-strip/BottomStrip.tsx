'use client'

import ShiftTimelineBar from './ShiftTimelineBar'
import HandoffButton from './HandoffButton'

export default function BottomStrip() {
  return (
    <div className="h-[60px] flex items-center px-3 gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex-shrink-0">
      <ShiftTimelineBar />
      <HandoffButton />
    </div>
  )
}
