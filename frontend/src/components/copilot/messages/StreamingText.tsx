'use client'

import { motion } from 'motion/react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { useStreamingText } from '@/hooks/useStreamingText'
import { formatTimestamp } from '@/lib/formatters'

interface StreamingTextProps {
  content: string
  timestamp: number
  isStreaming?: boolean
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 text-xs font-semibold text-[var(--text-primary)]">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-[var(--bg-elevated)] px-1 py-0.5 text-[11px] text-[var(--accent-cyan)]">
      {children}
    </code>
  ),
}

export default function StreamingText({ content, timestamp, isStreaming }: StreamingTextProps) {
  const { displayedText, isComplete } = useStreamingText(content, 16)
  const showCursor = isStreaming && !isComplete

  return (
    <div className="mx-3 my-2 p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[11px] font-semibold text-[var(--accent-indigo)]">WATT</span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          {formatTimestamp(timestamp, 'HH:mm:ss')}
        </span>
      </div>
      <div className="font-mono text-xs text-[var(--text-secondary)] leading-relaxed">
        <ReactMarkdown components={markdownComponents}>{displayedText}</ReactMarkdown>
        {showCursor && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.53, repeat: Infinity }}
            className="inline-block w-2 h-3 bg-[var(--accent-cyan)] ml-0.5 align-middle"
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}
