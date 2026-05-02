'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useUIStore } from '@/stores/uiStore'
import dynamic from 'next/dynamic'

// Lazy-load each tab
const GridMonitorTab = dynamic(() => import('@/components/grid-monitor/GridMonitorTab'), { ssr: false })
const IncidentsTab = dynamic(() => import('@/components/incidents/IncidentsTab'))
const ShiftLogTab = dynamic(() => import('@/components/shift-log/ShiftLogTab'))
const PlaybookTab = dynamic(() => import('@/components/playbook/PlaybookTab'))
const AnalyticsTab = dynamic(() => import('@/components/analytics/AnalyticsTab'), { ssr: false })
const SettingsTab = dynamic(() => import('@/components/settings/SettingsTab'))

const tabVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
}

export default function TabContent() {
  const activeTab = useUIStore((s) => s.activeTab)

  const tabMap: Record<string, React.ReactNode> = {
    'grid-monitor': <GridMonitorTab />,
    'incidents': <IncidentsTab />,
    'shift-log': <ShiftLogTab />,
    'playbook': <PlaybookTab />,
    'analytics': <AnalyticsTab />,
    'settings': <SettingsTab />,
  }

  return (
    <div className="h-full overflow-hidden" role="tabpanel" aria-label={activeTab}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="h-full"
        >
          {tabMap[activeTab]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
