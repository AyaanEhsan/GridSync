'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TabId } from '@/lib/constants'

interface UIStore {
  activeTab: TabId
  copilotCollapsed: boolean
  chartAnimationsEnabled: boolean
  theme: 'dark' | 'light'
  wattConfidenceThreshold: number
  setActiveTab: (tab: TabId) => void
  setCopilotCollapsed: (v: boolean) => void
  setChartAnimationsEnabled: (v: boolean) => void
  setTheme: (theme: 'dark' | 'light') => void
  setWattConfidenceThreshold: (v: number) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      activeTab: 'grid-monitor',
      copilotCollapsed: false,
      chartAnimationsEnabled: true,
      theme: 'dark',
      wattConfidenceThreshold: 70,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setCopilotCollapsed: (v) => set({ copilotCollapsed: v }),
      setChartAnimationsEnabled: (v) => set({ chartAnimationsEnabled: v }),
      setTheme: (theme) => {
        set({ theme })
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.theme = theme
          document.documentElement.classList.toggle('dark', theme === 'dark')
        }
      },
      setWattConfidenceThreshold: (v) => set({ wattConfidenceThreshold: v }),
    }),
    { name: 'watt-ui-store' }
  )
)
