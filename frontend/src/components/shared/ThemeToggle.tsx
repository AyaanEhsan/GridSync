'use client'

import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

export default function ThemeToggle() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const isDark = theme === 'dark'

  // Sync to DOM on mount (handles initial hydration)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme, isDark])

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="relative flex-shrink-0 cursor-pointer"
      style={{
        width: 44,
        height: 24,
        borderRadius: 9999,
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        style={{
          width: 18,
          height: 18,
          borderRadius: 9999,
          backgroundColor: 'var(--accent-amber)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: isDark ? 0 : 20,
          flexShrink: 0,
        }}
      >
        {isDark
          ? <Moon size={9} color="var(--bg-primary)" strokeWidth={2.5} />
          : <Sun  size={9} color="var(--bg-primary)" strokeWidth={2.5} />
        }
      </motion.div>
    </button>
  )
}
