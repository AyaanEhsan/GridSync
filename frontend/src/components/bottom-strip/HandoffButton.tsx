'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'

export default function HandoffButton() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 2500))
    setLoading(false)
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-1.5 rounded text-xs font-mono font-semibold text-white flex-shrink-0 disabled:opacity-70 transition-opacity"
      style={{
        background: 'linear-gradient(135deg, var(--accent-indigo) 0%, var(--accent-cyan) 100%)',
        boxShadow: '0 0 16px rgba(99,102,241,0.25)',
      }}
      aria-label="Generate handoff brief"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileText className="w-3.5 h-3.5" />
      )}
      Generate Handoff Brief
    </motion.button>
  )
}
