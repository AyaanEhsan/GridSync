'use client'

import { memo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Sparkline from '@/components/shared/Sparkline'
import type { SparklinePoint } from '@/lib/types'

interface MetricChipProps {
  label: string
  value: string
  color?: string
  sparklineData?: SparklinePoint[]
  trend?: 'up' | 'down' | 'stable'
  trendColor?: string
  pulse?: boolean
  badge?: number
  onClick?: () => void
  className?: string
}

const MetricChip = memo(function MetricChip({
  label,
  value,
  color = 'var(--accent-cyan)',
  sparklineData,
  trend = 'stable',
  trendColor,
  pulse = false,
  badge,
  onClick,
  className,
}: MetricChipProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const resolvedTrendColor = trendColor ?? (trend === 'up' ? 'var(--accent-green)' : trend === 'down' ? 'var(--accent-red)' : 'var(--text-muted)')

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 h-12 border-r border-[var(--border-subtle)]',
        'hover:bg-[var(--bg-hover)] transition-colors cursor-pointer text-left flex-shrink-0',
        className
      )}
      aria-label={`${label}: ${value}`}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest leading-none mb-1">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={value}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'text-sm font-mono font-semibold leading-none whitespace-nowrap',
                pulse && 'animate-pulse-glow'
              )}
              style={{ color }}
            >
              {value}
            </motion.span>
          </AnimatePresence>

          {badge !== undefined && badge > 0 && (
            <span
              className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-red)] text-white animate-[ring-pulse_2s_ease-in-out_infinite]"
              aria-label={`${badge} active`}
            >
              {badge > 9 ? '9+' : badge}
            </span>
          )}

          <TrendIcon
            className="w-2.5 h-2.5 flex-shrink-0"
            style={{ color: resolvedTrendColor }}
            aria-hidden
          />
        </div>
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <Sparkline data={sparklineData} color={color} width={56} height={22} />
      )}
    </button>
  )
})

export default MetricChip
