'use client'

import { useEffect, useRef, useState } from 'react'

type SSEStatus = 'connecting' | 'connected' | 'error' | 'closed'

interface SSEOptions {
  onMessage?: (data: string) => void
  onError?: (error: Event) => void
  enabled?: boolean
}

interface SSEResult {
  status: SSEStatus
  reconnect: () => void
}

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export function useSSE(url: string, options: SSEOptions = {}): SSEResult {
  const { onMessage, onError, enabled = true } = options
  const [status, setStatus] = useState<SSEStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)
  const reconnectCountRef = useRef(0)

  const connect = () => {
    if (DEMO_MODE || !enabled) {
      setStatus('connected')
      return
    }

    esRef.current?.close()

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setStatus('connected')
    es.onmessage = (e) => onMessage?.(e.data)
    es.onerror = (e) => {
      setStatus('error')
      onError?.(e)
      es.close()

      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectCountRef.current, 30000)
      reconnectCountRef.current++
      setTimeout(connect, delay)
    }
  }

  useEffect(() => {
    if (!enabled) return
    connect()
    return () => {
      esRef.current?.close()
      setStatus('closed')
    }
  }, [url, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return { status, reconnect: connect }
}
