'use client'

import { motion } from 'motion/react'
import IncidentFilters from './IncidentFilters'
import IncidentTable from './IncidentTable'

export default function IncidentsTab() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)]"
    >
      <IncidentFilters />
      <IncidentTable />
    </motion.div>
  )
}
