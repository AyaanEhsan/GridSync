'use client'

import { create } from 'zustand'
import type {
  GridMetrics,
  GridState,
  FrequencyDataPoint,
  LoadDataPoint,
  Alarm,
  SparklinePoint,
  DashboardSnapshot,
  FastLoadSnapshot,
  FuelMixRow,
  LMPRow,
  WeatherSnapshot,
} from '@/lib/types'

export type FetchStatus = 'loading' | 'live' | 'partial' | 'stale' | 'rate_limited' | 'error'
import { getGridState } from '@/lib/formatters'
import { SPARKLINE_POINTS, LOAD_HISTORY_POINTS } from '@/lib/constants'

interface DemoBackup {
  metrics: GridMetrics
  alarms: Alarm[]
  frequencyHistory: FrequencyDataPoint[]
  loadHistory: LoadDataPoint[]
  loadSparkline: SparklinePoint[]
  dcLoadSparkline: SparklinePoint[]
}

interface GridStore {
  metrics: GridMetrics
  frequencyHistory: FrequencyDataPoint[]
  loadHistory: LoadDataPoint[]
  loadSparkline: SparklinePoint[]
  dcLoadSparkline: SparklinePoint[]
  alarms: Alarm[]
  selectedRegion: string | null
  gridState: GridState

  // Live API data
  snapshot: DashboardSnapshot | null
  fuelMix: FuelMixRow | null
  lmpERCOTRealtime: LMPRow | null
  lmpERCOTDayAhead: LMPRow[]
  lmpPJMRealtime: LMPRow | null
  lmpPJMDayAhead: LMPRow[]
  weather: WeatherSnapshot | null
  lastFetchedAt: number | null
  isError: boolean
  fetchStatus: FetchStatus

  // Demo lifecycle
  demoMode: boolean
  demoBackup: DemoBackup | null

  // Mutations
  updateMetrics: (partial: Partial<GridMetrics>) => void
  addAlarm: (alarm: Alarm) => void
  acknowledgeAlarm: (id: string) => void
  setSelectedRegion: (region: string | null) => void
  pushFrequencyPoint: (point: FrequencyDataPoint) => void
  pushLoadPoint: (point: LoadDataPoint) => void

  setSnapshot: (snap: DashboardSnapshot) => void
  setFastLoad: (snap: FastLoadSnapshot) => void
  setIsError: (e: boolean) => void
  setFetchStatus: (s: FetchStatus) => void

  startDemo: () => void
  stopDemo: () => void
  clearAlarms: () => void
}

const INITIAL_METRICS: GridMetrics = {
  frequency: 60.0,
  load: 0,
  forecastLoad: 0,
  forecastDeviation: 0,
  alarmCount: 0,
  dcLoad: 0,
  timestamp: Date.now(),
}

function loadHistoryFromSnapshot(rows: { interval_start_utc: string; load: number }[]): LoadDataPoint[] {
  return rows
    .map((r) => ({
      timestamp: new Date(r.interval_start_utc).getTime(),
      actual: r.load,
      forecast: r.load,
    }))
    .filter((p) => Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-LOAD_HISTORY_POINTS)
}

function sparklineFromHistory(history: LoadDataPoint[]): SparklinePoint[] {
  return history.slice(-SPARKLINE_POINTS).map((p) => ({
    timestamp: p.timestamp,
    value: p.actual,
  }))
}

export const useGridStore = create<GridStore>()((set, get) => ({
  metrics: INITIAL_METRICS,
  frequencyHistory: [],
  loadHistory: [],
  loadSparkline: [],
  dcLoadSparkline: [],
  alarms: [],
  selectedRegion: null,
  gridState: 'nominal',

  snapshot: null,
  fuelMix: null,
  lmpERCOTRealtime: null,
  lmpERCOTDayAhead: [],
  lmpPJMRealtime: null,
  lmpPJMDayAhead: [],
  weather: null,
  lastFetchedAt: null,
  isError: false,
  fetchStatus: 'loading' as FetchStatus,

  demoMode: false,
  demoBackup: null,

  updateMetrics: (partial) =>
    set((state) => {
      const next = { ...state.metrics, ...partial, timestamp: Date.now() }
      const newGridState = getGridState(next.frequency, next.forecastDeviation)
      return { metrics: next, gridState: newGridState }
    }),

  addAlarm: (alarm) =>
    set((state) => ({
      alarms: [alarm, ...state.alarms].slice(0, 50),
      metrics: { ...state.metrics, alarmCount: state.metrics.alarmCount + 1 },
    })),

  acknowledgeAlarm: (id) =>
    set((state) => ({
      alarms: state.alarms.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
      metrics: {
        ...state.metrics,
        alarmCount: Math.max(0, state.metrics.alarmCount - 1),
      },
    })),

  setSelectedRegion: (region) => set({ selectedRegion: region }),

  pushFrequencyPoint: (point) =>
    set((state) => ({
      frequencyHistory: [...state.frequencyHistory, point].slice(-SPARKLINE_POINTS),
    })),

  pushLoadPoint: (point) =>
    set((state) => ({
      loadHistory: [...state.loadHistory, point].slice(-LOAD_HISTORY_POINTS),
    })),

  setSnapshot: (snap) =>
    set((state) => {
      // Skip if currently in demo mode — demo owns the store
      if (state.demoMode) return {}
      const loadHistory = loadHistoryFromSnapshot(snap.load_history)
      const loadSparkline = sparklineFromHistory(loadHistory)
      const realtime = snap.realtime
      const baseMetrics: GridMetrics = realtime
        ? {
            ...state.metrics,
            load: realtime.load,
            timestamp: Date.now(),
          }
        : state.metrics
      return {
        snapshot: snap,
        fuelMix: realtime
          ? {
              interval_start_utc: realtime.interval_start_utc,
              natural_gas: realtime.natural_gas,
              coal_and_lignite: realtime.coal_and_lignite,
              nuclear: realtime.nuclear,
              wind: realtime.wind,
              solar: realtime.solar,
              hydro: realtime.hydro,
              power_storage: realtime.power_storage,
              other: realtime.other,
            }
          : state.fuelMix,
        lmpERCOTRealtime: snap.pricing.ercot.realtime,
        lmpERCOTDayAhead: snap.pricing.ercot.day_ahead,
        lmpPJMRealtime: snap.pricing.pjm.realtime,
        lmpPJMDayAhead: snap.pricing.pjm.day_ahead,
        weather: snap.weather,
        lastFetchedAt: Date.now(),
        loadHistory: loadHistory.length ? loadHistory : state.loadHistory,
        loadSparkline: loadSparkline.length ? loadSparkline : state.loadSparkline,
        metrics: baseMetrics,
        gridState: getGridState(baseMetrics.frequency, baseMetrics.forecastDeviation),
        isError: false,
        fetchStatus: snap.rate_limited
          ? 'rate_limited'
          : snap.partial
          ? 'partial'
          : 'live',
      }
    }),

  setFastLoad: (snap) =>
    set((state) => {
      if (state.demoMode || !snap.realtime_load) return {}
      const r = snap.realtime_load
      const ts = new Date(r.interval_start_utc).getTime() || Date.now()
      const point: LoadDataPoint = { timestamp: ts, actual: r.load, forecast: r.load }
      const last = state.loadHistory[state.loadHistory.length - 1]
      const nextHistory =
        last && last.timestamp === point.timestamp
          ? state.loadHistory
          : [...state.loadHistory, point].slice(-LOAD_HISTORY_POINTS)
      const nextSparkline = sparklineFromHistory(nextHistory)
      const baseMetrics = { ...state.metrics, load: r.load, timestamp: Date.now() }
      return {
        loadHistory: nextHistory,
        loadSparkline: nextSparkline,
        metrics: baseMetrics,
        gridState: getGridState(baseMetrics.frequency, baseMetrics.forecastDeviation),
        lastFetchedAt: Date.now(),
        isError: false,
      }
    }),

  setIsError: (e) => set({ isError: e }),
  setFetchStatus: (s) => set({ fetchStatus: s }),

  startDemo: () => {
    const s = get()
    if (s.demoMode) return
    const backup: DemoBackup = {
      metrics: s.metrics,
      alarms: s.alarms,
      frequencyHistory: s.frequencyHistory,
      loadHistory: s.loadHistory,
      loadSparkline: s.loadSparkline,
      dcLoadSparkline: s.dcLoadSparkline,
    }
    set({ demoMode: true, demoBackup: backup, alarms: [] })
  },

  stopDemo: () => {
    const s = get()
    if (!s.demoMode) return
    const b = s.demoBackup
    set({
      demoMode: false,
      demoBackup: null,
      ...(b
        ? {
            metrics: b.metrics,
            alarms: b.alarms,
            frequencyHistory: b.frequencyHistory,
            loadHistory: b.loadHistory,
            loadSparkline: b.loadSparkline,
            dcLoadSparkline: b.dcLoadSparkline,
            gridState: getGridState(b.metrics.frequency, b.metrics.forecastDeviation),
          }
        : {}),
    })
  },

  clearAlarms: () => set({ alarms: [], metrics: { ...get().metrics, alarmCount: 0 } }),
}))
