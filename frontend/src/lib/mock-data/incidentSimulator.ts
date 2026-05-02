import type {
  Alarm,
  AlarmSeverity,
  DashboardSnapshot,
  ERCOTLoadRow,
  FuelMixRow,
  LMPRow,
} from '@/lib/types'

export const CYCLE_DURATION_MS = 90_000
export const TICK_MS = 1_000
const TICKS_PER_CYCLE = CYCLE_DURATION_MS / TICK_MS

export type IncidentPhase = 'precursor' | 'dip' | 'cascade' | 'recovery'

export interface IncidentFrame {
  cycle: number
  tickInCycle: number
  phase: IncidentPhase
  cycleJustStarted: boolean
  cycleJustEnded: boolean
  frequency: number
  load: number
  fuelMix: FuelMixRow
  lmpERCOT: LMPRow
  lmpPJM: LMPRow
  newAlarms: Alarm[]
  snapshot: DashboardSnapshot
}

const ALARM_TEMPLATES: { severity: AlarmSeverity; description: string; region: string }[] = [
  { severity: 'critical', description: 'NERC: Frequency excursion below 59.90 Hz — Reliability Coordinator notified', region: 'ERCOT' },
  { severity: 'major', description: 'Unit 7 (Comanche Peak) trip detected — 1,150 MW lost', region: 'ERCOT' },
  { severity: 'major', description: 'AGC regulation reserve depleted — secondary response engaged', region: 'ERCOT' },
  { severity: 'minor', description: 'Wind generation ramp-down: 480 MW over 4 minutes', region: 'ERCOT' },
  { severity: 'minor', description: 'HB_NORTH LMP spike: $312/MWh (above $200 threshold)', region: 'ERCOT' },
  { severity: 'minor', description: 'Tie-line flow reversal on DC interconnect', region: 'ERCOT' },
  { severity: 'minor', description: 'Datacenter corridor load surge: +220 MW', region: 'ERCOT' },
  { severity: 'info', description: 'Fast-start unit dispatch request issued — Unit 3', region: 'ERCOT' },
]

function phaseFor(tick: number): IncidentPhase {
  if (tick < 10) return 'precursor'
  if (tick < 25) return 'dip'
  if (tick < 55) return 'cascade'
  return 'recovery'
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function jitter(amp: number) {
  return (Math.random() - 0.5) * amp
}

function frequencyForTick(tick: number, cycleSeed: number): number {
  const phase = phaseFor(tick)
  const wobble = Math.sin((tick + cycleSeed) * 0.4) * 0.004 + jitter(0.003)
  switch (phase) {
    case 'precursor':
      return 60.0 + wobble
    case 'dip': {
      // Linear ramp 60.00 -> 59.85 over 15s
      const t = (tick - 10) / 15
      return clamp(60.0 - t * 0.15 + wobble * 0.5, 59.78, 60.05)
    }
    case 'cascade': {
      // Bottom oscillation around 59.88
      return clamp(59.88 + Math.sin((tick - 25) * 0.6) * 0.04 + wobble, 59.8, 60.0)
    }
    case 'recovery': {
      // Linear ramp 59.92 -> 60.00 over 35s
      const t = (tick - 55) / 35
      return clamp(59.92 + t * 0.08 + wobble * 0.5, 59.85, 60.05)
    }
  }
}

function loadForTick(tick: number, baseLoad: number): number {
  const phase = phaseFor(tick)
  switch (phase) {
    case 'precursor':
      return baseLoad + jitter(80)
    case 'dip': {
      const t = (tick - 10) / 15
      return baseLoad + t * 800 + jitter(120)
    }
    case 'cascade':
      return baseLoad + 800 + jitter(200)
    case 'recovery': {
      const t = (tick - 55) / 35
      return baseLoad + 800 - t * 800 + jitter(120)
    }
  }
}

function fuelMixForTick(tick: number, base: FuelMixRow): FuelMixRow {
  const phase = phaseFor(tick)
  const stress = phase === 'cascade' ? 1 : phase === 'dip' ? 0.6 : phase === 'recovery' ? 0.3 : 0
  return {
    interval_start_utc: new Date().toISOString(),
    natural_gas: Math.max(0, base.natural_gas + stress * 1500 + jitter(100)),
    coal_and_lignite: Math.max(0, base.coal_and_lignite + stress * 200 + jitter(40)),
    nuclear: Math.max(0, base.nuclear + jitter(20)),
    wind: Math.max(0, base.wind - stress * 600 + jitter(80)),
    solar: Math.max(0, base.solar - stress * 200 + jitter(40)),
    hydro: Math.max(0, base.hydro + stress * 100 + jitter(20)),
    power_storage: base.power_storage + jitter(50),
    other: Math.max(0, base.other + jitter(20)),
  }
}

function lmpForTick(tick: number, base: LMPRow, multiplier: number): LMPRow {
  const phase = phaseFor(tick)
  const surge = phase === 'cascade' ? 4.5 : phase === 'dip' ? 2.2 : phase === 'recovery' ? 1.5 : 1.0
  const lmp = base.lmp * surge * multiplier + jitter(8)
  return {
    interval_start_utc: new Date().toISOString(),
    location: base.location,
    location_type: base.location_type,
    lmp,
    energy: lmp * 0.85,
    congestion: lmp * 0.13,
    loss: base.loss,
  }
}

const DEFAULT_FUEL_MIX: FuelMixRow = {
  interval_start_utc: new Date().toISOString(),
  natural_gas: 22000,
  coal_and_lignite: 5600,
  nuclear: 5100,
  wind: 8800,
  solar: 3200,
  hydro: 600,
  power_storage: -800,
  other: 400,
}

const DEFAULT_LMP_ERCOT: LMPRow = {
  interval_start_utc: new Date().toISOString(),
  location: 'HB_NORTH',
  location_type: 'Hub',
  lmp: 38,
  energy: 35,
  congestion: 3,
  loss: 0,
}

const DEFAULT_LMP_PJM: LMPRow = {
  interval_start_utc: new Date().toISOString(),
  location: 'PJM RTO',
  location_type: 'Zone',
  lmp: 42,
  energy: 38,
  congestion: 3,
  loss: 1,
}

export interface SimulatorState {
  startedAt: number
  cycleSeed: number
  emittedAlarmKeys: Set<string>
  baseSnapshot: DashboardSnapshot | null
}

export function createSimulatorState(baseSnapshot: DashboardSnapshot | null): SimulatorState {
  return {
    startedAt: Date.now(),
    cycleSeed: Math.random() * 1000,
    emittedAlarmKeys: new Set(),
    baseSnapshot,
  }
}

export function nextIncidentFrame(state: SimulatorState, now: number): IncidentFrame {
  const elapsed = now - state.startedAt
  const cycle = Math.floor(elapsed / CYCLE_DURATION_MS)
  const tickInCycle = Math.floor((elapsed % CYCLE_DURATION_MS) / TICK_MS)
  const phase = phaseFor(tickInCycle)
  const cycleSeed = state.cycleSeed + cycle * 17.3

  const cycleJustStarted = tickInCycle === 0
  const cycleJustEnded = tickInCycle === TICKS_PER_CYCLE - 1

  const baseLoadRow: ERCOTLoadRow | undefined =
    state.baseSnapshot?.realtime ?? state.baseSnapshot?.load_history.at(-1)
  const baseLoad = baseLoadRow?.load ?? 41000

  const baseFuel: FuelMixRow = state.baseSnapshot?.realtime
    ? {
        interval_start_utc: state.baseSnapshot.realtime.interval_start_utc,
        natural_gas: state.baseSnapshot.realtime.natural_gas,
        coal_and_lignite: state.baseSnapshot.realtime.coal_and_lignite,
        nuclear: state.baseSnapshot.realtime.nuclear,
        wind: state.baseSnapshot.realtime.wind,
        solar: state.baseSnapshot.realtime.solar,
        hydro: state.baseSnapshot.realtime.hydro,
        power_storage: state.baseSnapshot.realtime.power_storage,
        other: state.baseSnapshot.realtime.other,
      }
    : DEFAULT_FUEL_MIX

  const baseERCOTLMP = state.baseSnapshot?.pricing.ercot.realtime ?? DEFAULT_LMP_ERCOT
  const basePJMLMP = state.baseSnapshot?.pricing.pjm.realtime ?? DEFAULT_LMP_PJM

  const frequency = frequencyForTick(tickInCycle, cycleSeed)
  const load = loadForTick(tickInCycle, baseLoad)
  const fuelMix = fuelMixForTick(tickInCycle, baseFuel)
  const lmpERCOT = lmpForTick(tickInCycle, baseERCOTLMP, 1)
  const lmpPJM = lmpForTick(tickInCycle, basePJMLMP, 0.7)

  const newAlarms: Alarm[] = []
  // Schedule alarms across cascade phase, deduped per cycle
  const scheduleTick: Record<number, number> = { 11: 0, 16: 1, 22: 2, 28: 3, 34: 4, 40: 5, 46: 6, 52: 7 }
  const idx = scheduleTick[tickInCycle]
  if (idx !== undefined) {
    const tpl = ALARM_TEMPLATES[idx]
    const key = `${cycle}-${idx}`
    if (!state.emittedAlarmKeys.has(key)) {
      state.emittedAlarmKeys.add(key)
      newAlarms.push({
        id: `ALM-${now}-${idx}`,
        severity: tpl.severity,
        region: tpl.region,
        description: tpl.description,
        timestamp: now,
        acknowledged: false,
        source: 'demo-incident',
      })
    }
  }

  const ercotDA = state.baseSnapshot?.pricing.ercot.day_ahead ?? []
  const pjmDA = state.baseSnapshot?.pricing.pjm.day_ahead ?? []
  const weather = state.baseSnapshot?.weather ?? null
  const loadHistory = state.baseSnapshot?.load_history ?? []

  const snapshot: DashboardSnapshot = {
    realtime: {
      ...fuelMix,
      interval_start_utc: new Date(now).toISOString(),
      interval_end_utc: new Date(now + 5 * 60_000).toISOString(),
      load,
    },
    pricing: {
      ercot: { realtime: lmpERCOT, day_ahead: ercotDA },
      pjm: { realtime: lmpPJM, day_ahead: pjmDA },
    },
    weather,
    load_history: loadHistory,
    fetched_at: new Date(now).toISOString(),
    partial: state.baseSnapshot === null,
  }

  return {
    cycle,
    tickInCycle,
    phase,
    cycleJustStarted,
    cycleJustEnded,
    frequency,
    load,
    fuelMix,
    lmpERCOT,
    lmpPJM,
    newAlarms,
    snapshot,
  }
}
