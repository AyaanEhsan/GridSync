'use client'

import { useEffect, useRef } from 'react'
import { useGridStore } from '@/stores/gridStore'
import { useCopilotStore } from '@/stores/copilotStore'
import {
  createSimulatorState,
  nextIncidentFrame,
  TICK_MS,
  type SimulatorState,
} from '@/lib/mock-data/incidentSimulator'
import type { DashboardSnapshot, FastLoadSnapshot } from '@/lib/types'
import { SPARKLINE_POINTS } from '@/lib/constants'

const POLL_FULL_MS = 5 * 60_000
// Initial fast-poll fires after 20s so the full route (~8-9s serial execution)
// finishes before /api/grid/load also calls ercot_load — avoids 429 race.
const POLL_FAST_BOOT_MS = 20_000
const POLL_FAST_MS = 30_000
const MAX_RETRIES = 3

function isDashboardSnapshot(v: unknown): v is DashboardSnapshot {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.fetched_at === 'string' &&
    Array.isArray(o.load_history) &&
    typeof o.pricing === 'object' &&
    o.pricing !== null
  )
}

function isFastLoadSnapshot(v: unknown): v is FastLoadSnapshot {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.fetched_at === 'string' && 'realtime_load' in o
}

async function fetchJson<T>(
  url: string,
  signal: AbortSignal,
  guard: (v: unknown) => v is T,
): Promise<T> {
  const res = await fetch(url, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const json: unknown = await res.json()
  if (!guard(json)) throw new Error(`${url} malformed payload`)
  return json
}

export function useGridDashboard() {
  // Only subscribe to the reactive value needed to switch modes.
  // Store actions are accessed via getState() inside effects — they are
  // stable references and do not belong in the deps array.
  const demoMode = useGridStore((s) => s.demoMode)
  const simStateRef = useRef<SimulatorState | null>(null)

  // ── Live polling ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (demoMode) return

    let disposed = false
    const ctrl = new AbortController()
    let fullFailures = 0
    let fastFailures = 0

    const store = () => useGridStore.getState()

    // Show loading only on first mount when no data exists yet
    if (!store().snapshot) store().setFetchStatus('loading')

    const pollFull = async () => {
      try {
        const snap = await fetchJson('/api/grid', ctrl.signal, isDashboardSnapshot)
        if (disposed) return
        store().setSnapshot(snap)
        store().setIsError(false)
        fullFailures = 0
      } catch (err) {
        if (disposed || ctrl.signal.aborted) return
        fullFailures += 1
        if (fullFailures >= MAX_RETRIES) {
          store().setIsError(true)
          store().setFetchStatus(String(err).includes('429') ? 'rate_limited' : 'error')
        }
        console.error('[useGridDashboard] full poll failed', err)
      }
    }

    const pollFast = async () => {
      try {
        const snap = await fetchJson('/api/grid/load', ctrl.signal, isFastLoadSnapshot)
        if (disposed) return
        store().setFastLoad(snap)
        fastFailures = 0
      } catch (err) {
        if (disposed || ctrl.signal.aborted) return
        fastFailures += 1
        if (fastFailures >= MAX_RETRIES) store().setIsError(true)
        // Fast-load API failures are runtime data issues and should not be
        // confused with SSR hydration mismatches.
        console.error('[useGridDashboard] fast poll failed', err)
      }
    }

    void pollFull()
    // Delay first fast poll so the full route's serial GridStatus calls finish
    // before /api/grid/load fires its own ercot_load request.
    const fastBoot = window.setTimeout(() => void pollFast(), POLL_FAST_BOOT_MS)
    const fullId = window.setInterval(pollFull, POLL_FULL_MS)
    const fastId = window.setInterval(pollFast, POLL_FAST_MS)

    return () => {
      disposed = true
      ctrl.abort()
      window.clearTimeout(fastBoot)
      window.clearInterval(fullId)
      window.clearInterval(fastId)
    }
  }, [demoMode]) // ← demoMode only; actions via getState() are stable

  // ── Demo loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!demoMode) {
      simStateRef.current = null
      return
    }

    const baseSnapshot = useGridStore.getState().snapshot
    simStateRef.current = createSimulatorState(baseSnapshot)

    useGridStore.setState({
      frequencyHistory: [],
      alarms: [],
      metrics: { ...useGridStore.getState().metrics, alarmCount: 0 },
    })

    useCopilotStore.getState().runDemoScenario()

    let lastCycle = 0

    const tick = () => {
      const state = simStateRef.current
      if (!state) return
      const now = Date.now()
      const frame = nextIncidentFrame(state, now)

      const gs = useGridStore.getState()
      gs.updateMetrics({
        frequency: frame.frequency,
        load: frame.load,
        forecastLoad: frame.load * 1.01,
        forecastDeviation: ((frame.load - frame.load * 1.01) / (frame.load * 1.01)) * 100,
      })
      gs.pushFrequencyPoint({ timestamp: now, value: frame.frequency })

      // Sparkline only — loadHistory intentionally NOT touched (holds 5-min
      // API data; 1s writes would flood the LoadCurve X-axis).
      const nextSp = [
        ...useGridStore.getState().loadSparkline,
        { timestamp: now, value: frame.load },
      ].slice(-SPARKLINE_POINTS)

      useGridStore.setState({
        loadSparkline: nextSp,
        fuelMix: frame.fuelMix,
        lmpERCOTRealtime: frame.lmpERCOT,
        lmpPJMRealtime: frame.lmpPJM,
      })

      for (const a of frame.newAlarms) gs.addAlarm(a)

      if (frame.cycle > lastCycle) {
        lastCycle = frame.cycle
        useCopilotStore.getState().runDemoScenario()
      }
    }

    tick()
    const id = window.setInterval(tick, TICK_MS)
    return () => {
      window.clearInterval(id)
      simStateRef.current = null
    }
  }, [demoMode])
}
