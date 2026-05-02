'use client'

import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useCopilotStore } from '@/stores/copilotStore'
import AlertMessage from './messages/AlertMessage'
import StreamingText from './messages/StreamingText'
import PrecedentList from './messages/PrecedentCard'

export default function MessageStream() {
  const messages = useCopilotStore((s) => s.messages)
  const orderedMessages = useMemo(() => {
    const visibleMessages = messages.filter(
      (msg) => msg.type === 'alert' || msg.type === 'precedent' || msg.type === 'streaming'
    )
    return [
      ...visibleMessages.filter((msg) => msg.type !== 'streaming'),
      ...visibleMessages.filter((msg) => msg.type === 'streaming'),
    ]
  }, [messages])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [orderedMessages])

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto py-2 min-h-0"
      role="log"
      aria-live="polite"
      aria-label="WATT Co-Pilot messages"
    >
      <AnimatePresence initial={false}>
        {orderedMessages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            {msg.type === 'alert' && (
              <AlertMessage
                content={msg.content ?? ''}
                timestamp={msg.timestamp}
                severity={msg.alertSeverity ?? 'warning'}
              />
            )}
            {msg.type === 'streaming' && (
              <StreamingText
                content={msg.content ?? ''}
                timestamp={msg.timestamp}
                isStreaming={msg.isStreaming}
              />
            )}
            {msg.type === 'precedent' && msg.precedents && (
              <PrecedentList precedents={msg.precedents} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
