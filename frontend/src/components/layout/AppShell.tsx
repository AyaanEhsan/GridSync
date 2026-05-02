'use client'

import StatusRail from './StatusRail'
import MetricsStrip from '@/components/top-bar/MetricsStrip'
import PanelLayout from './PanelLayout'
import BottomStrip from '@/components/bottom-strip/BottomStrip'
import { useGridDashboard } from '@/hooks/useGridDashboard'
import { Monitor } from 'lucide-react'

function MobileGate() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-primary)] lg:hidden">
      <div className="text-center space-y-4 px-8">
        <Monitor className="w-14 h-14 text-[var(--text-muted)] mx-auto" aria-hidden />
        <h1 className="text-xl font-mono font-bold text-[var(--text-primary)]">Desktop Required</h1>
        <p className="font-mono text-sm text-[var(--text-secondary)] max-w-xs leading-relaxed">
          WATT Grid Co-Pilot is designed for control room workstations at 1366×768+.
        </p>
      </div>
    </div>
  )
}

export default function AppShell() {
  useGridDashboard()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
      <MobileGate />
      <StatusRail />
      <MetricsStrip />
      <PanelLayout />
      <BottomStrip />
    </div>
  )
}
