'use client'

import { create } from 'zustand'
import type { CopilotMessage, AgentStatus, Recommendation } from '@/lib/types'
import { INITIAL_MESSAGES, JULY10_SCENARIO_STEPS } from '@/lib/mock-data/copilotScenarios'
import { useShiftStore } from './shiftStore'
import { useGridStore } from './gridStore'
import { useUIStore } from './uiStore'
import { buildRunDemoMessage } from '@/lib/agentChat'

interface CopilotStore {
  messages: CopilotMessage[]
  agentStatus: AgentStatus
  streamingMessageId: string | null
  isRunningDemo: boolean
  lastRunDemoMessagePayload: string | null
  addMessage: (msg: CopilotMessage) => void
  appendStreamingChunk: (id: string, chunk: string) => void
  finalizeStreaming: (id: string) => void
  setAgentStatus: (status: AgentStatus) => void
  retryLastRunDemoAgentRequest: () => void
  approveRecommendation: (messageId: string) => void
  modifyRecommendation: (messageId: string, modified: Partial<Recommendation>) => void
  sendOperatorMessage: (text: string, operatorName?: string) => void
  runDemoScenario: () => void
}

const BACKEND_API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ?? 'http://localhost:8000'
const RUN_DEMO_AGENT_STREAM_URL = `${BACKEND_API_BASE_URL}/agent/main/stream`
const FIRST_TOKEN_TIMEOUT_MS = 20_000
const TOTAL_TIMEOUT_MS = 60_000
let activeRunDemoAbortController: AbortController | null = null

function formatRunDemoError(detail: string): string {
  if (detail.includes('timed out')) {
    return 'Agent response timed out. Please retry.'
  }
  return `Agent stream failed: ${detail}`
}

async function streamRunDemoAgent(messagePayload: string, streamingMessageId: string): Promise<void> {
  useUIStore.getState().setCopilotCollapsed(false)

  activeRunDemoAbortController?.abort()
  const controller = new AbortController()
  activeRunDemoAbortController = controller
  let firstTokenSeen = false

  const firstTokenTimeout = window.setTimeout(() => {
    if (!firstTokenSeen) {
      controller.abort(new Error('first token timed out'))
    }
  }, FIRST_TOKEN_TIMEOUT_MS)
  const totalTimeout = window.setTimeout(() => {
    controller.abort(new Error('stream timed out'))
  }, TOTAL_TIMEOUT_MS)

  try {
    const res = await fetch(RUN_DEMO_AGENT_STREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messagePayload }),
      signal: controller.signal,
    })

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let streamDone = false

    while (!streamDone) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let splitIdx = buffer.indexOf('\n\n')
      while (splitIdx !== -1) {
        const rawRecord = buffer.slice(0, splitIdx)
        buffer = buffer.slice(splitIdx + 2)
        splitIdx = buffer.indexOf('\n\n')
        if (!rawRecord.trim()) continue

        let eventType = 'message'
        const dataLines: string[] = []
        for (const line of rawRecord.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
            continue
          }
          if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
          }
        }

        const rawData = dataLines.join('\n')
        let payload: Record<string, unknown> = {}
        if (rawData) {
          try {
            payload = JSON.parse(rawData) as Record<string, unknown>
          } catch {
            continue
          }
        }

        if (eventType === 'token') {
          const text = typeof payload.text === 'string' ? payload.text : ''
          if (!text) continue
          if (!firstTokenSeen) {
            firstTokenSeen = true
            window.clearTimeout(firstTokenTimeout)
            const existing = useCopilotStore.getState().messages.find((m) => m.id === streamingMessageId)
            if (existing?.content === 'Thinking...') {
              useCopilotStore.setState((state) => ({
                messages: state.messages.map((m) =>
                  m.id === streamingMessageId ? { ...m, content: '' } : m
                ),
              }))
            }
          }
          useCopilotStore.getState().appendStreamingChunk(streamingMessageId, text)
        } else if (eventType === 'error') {
          const detail = typeof payload.detail === 'string' ? payload.detail : 'Unknown error'
          throw new Error(detail)
        } else if (eventType === 'done') {
          streamDone = true
        }
      }
    }

    useCopilotStore.getState().finalizeStreaming(streamingMessageId)
    useCopilotStore.getState().setAgentStatus('monitoring')
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    useCopilotStore.getState().finalizeStreaming(streamingMessageId)
    useCopilotStore.getState().setAgentStatus('alert')
    useCopilotStore.getState().addMessage({
      id: generateId(),
      type: 'agent_error',
      timestamp: Date.now(),
      content: formatRunDemoError(detail),
      retryable: true,
    })
  } finally {
    window.clearTimeout(firstTokenTimeout)
    window.clearTimeout(totalTimeout)
    if (activeRunDemoAbortController === controller) {
      activeRunDemoAbortController = null
    }
  }
}

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useCopilotStore = create<CopilotStore>()((set, get) => ({
  messages: INITIAL_MESSAGES,
  agentStatus: 'monitoring',
  streamingMessageId: null,
  isRunningDemo: false,
  lastRunDemoMessagePayload: null,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  appendStreamingChunk: (id, chunk) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              content: (m.content ?? '') + chunk,
              streamedText: (m.streamedText ?? '') + chunk,
            }
          : m
      ),
    })),

  finalizeStreaming: (id) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
      streamingMessageId: null,
    })),

  setAgentStatus: (status) => set({ agentStatus: status }),

  retryLastRunDemoAgentRequest: () => {
    const payload = get().lastRunDemoMessagePayload
    if (!payload) return
    const streamingId = generateId()
    get().addMessage({
      id: streamingId,
      type: 'streaming',
      timestamp: Date.now(),
      content: 'Thinking...',
      isStreaming: true,
    })
    set({ streamingMessageId: streamingId })
    get().setAgentStatus('analyzing')
    void streamRunDemoAgent(payload, streamingId)
  },

  approveRecommendation: (messageId) => {
    const operatorName = 'Maria K.'
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.recommendation
          ? {
              ...m,
              recommendation: {
                ...m.recommendation,
                status: 'approved',
                approvedBy: operatorName,
                approvedAt: Date.now(),
              },
            }
          : m
      ),
    }))

    const msg = get().messages.find((m) => m.id === messageId)
    if (msg?.recommendation) {
      useShiftStore.getState().addEvent({
        id: `EVT-${Date.now()}`,
        type: 'operator',
        timestamp: Date.now(),
        title: 'WATT recommendation approved',
        description: msg.recommendation.action,
        operatorId: operatorName,
        approved: true,
        approvedBy: operatorName,
        approvedAt: Date.now(),
      })
    }
  },

  modifyRecommendation: (messageId, modified) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.recommendation
          ? {
              ...m,
              recommendation: {
                ...m.recommendation,
                ...modified,
                status: 'modified',
              },
            }
          : m
      ),
    })),

  sendOperatorMessage: (text, operatorName = 'Maria K.') => {
    const msg: CopilotMessage = {
      id: generateId(),
      type: 'operator',
      timestamp: Date.now(),
      content: text,
      operatorName,
    }
    get().addMessage(msg)
    get().setAgentStatus('analyzing')

    setTimeout(() => {
      get().addMessage({
        id: generateId(),
        type: 'streaming',
        timestamp: Date.now(),
        content: `Analyzing your query: "${text}". Searching historical database...`,
        isStreaming: true,
      })
    }, 600)

    setTimeout(() => get().setAgentStatus('monitoring'), 8000)
  },

  runDemoScenario: () => {
    if (get().isRunningDemo) return
    set({ isRunningDemo: true })
    get().setAgentStatus('alert')

    const grid = useGridStore.getState()
    const payload = buildRunDemoMessage({
      metrics: grid.metrics,
      snapshot: grid.snapshot,
      demoMode: grid.demoMode,
    })
    set({ lastRunDemoMessagePayload: payload })
    const streamingId = generateId()
    get().addMessage({
      id: streamingId,
      type: 'streaming',
      timestamp: Date.now(),
      content: 'Thinking...',
      isStreaming: true,
    })
    set({ streamingMessageId: streamingId })
    get().setAgentStatus('analyzing')
    // Fire-and-forget to keep demo loop non-blocking.
    void streamRunDemoAgent(payload, streamingId)

    let totalDelay = 0
    for (const step of JULY10_SCENARIO_STEPS) {
      totalDelay += step.delay
      const delay = totalDelay
      setTimeout(() => {
        const msg = step.message()
        get().addMessage(msg)

        if (msg.type === 'streaming') {
          get().setAgentStatus('analyzing')
        } else if (msg.type === 'recommendation') {
          get().setAgentStatus('drafting')
        }
      }, delay)
    }

    setTimeout(() => {
      set({ isRunningDemo: false })
    }, totalDelay + 2000)
  },
}))
