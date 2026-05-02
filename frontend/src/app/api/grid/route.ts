import {
  fetchLoadLatest,
  fetchLoadWindow,
  fetchFuelMix,
  fetchERCOTLMPRealtime,
  fetchERCOTLMPDayAhead,
  fetchPJMLMPRealtime,
  fetchPJMLMPDayAhead,
  fetchWeather,
} from '@/lib/gridstatus'
import type {
  DashboardSnapshot,
  ERCOTLoadRow,
  FuelMixRow,
  LMPRow,
  WeatherSnapshot,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

// ─── Server-side dedup + TTL cache ────────────────────────────────────────────
// Prevents concurrent browser loads / HMR hot-reloads from each firing 7
// serial GridStatus calls and exhausting the 30-req/min free-tier quota.
const CACHE_TTL_MS = 55_000

let cachedSnap: { snap: DashboardSnapshot; expiresAt: number } | null = null
let inflightFetch: Promise<DashboardSnapshot> | null = null

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const GRIDSTATUS_SPACING_MS = 1200

async function tryGet<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[api/grid] ${label} failed:`, (err as Error).message)
    return null
  }
}

async function fetchGridStatusSerial() {
  const out: {
    load: ERCOTLoadRow | null
    fuel: FuelMixRow | null
    loadHistory: ERCOTLoadRow[]
    ercotRt: LMPRow | null
    ercotDa: LMPRow[]
    pjmRt: LMPRow | null
    pjmDa: LMPRow[]
  } = { load: null, fuel: null, loadHistory: [], ercotRt: null, ercotDa: [], pjmRt: null, pjmDa: [] }

  const steps: Array<() => Promise<void>> = [
    async () => { out.load = await tryGet('load', fetchLoadLatest) },
    async () => { out.fuel = await tryGet('fuelMix', fetchFuelMix) },
    async () => { out.loadHistory = (await tryGet('loadHistory', () => fetchLoadWindow(6))) ?? [] },
    async () => { out.ercotRt = await tryGet('ercotRt', fetchERCOTLMPRealtime) },
    async () => { out.ercotDa = (await tryGet('ercotDa', fetchERCOTLMPDayAhead)) ?? [] },
    async () => { out.pjmRt = await tryGet('pjmRt', fetchPJMLMPRealtime) },
    async () => { out.pjmDa = (await tryGet('pjmDa', fetchPJMLMPDayAhead)) ?? [] },
  ]

  for (let i = 0; i < steps.length; i++) {
    await steps[i]()
    if (i < steps.length - 1) await sleep(GRIDSTATUS_SPACING_MS)
  }
  return out
}

async function buildFreshSnapshot(): Promise<DashboardSnapshot> {
  const [gs, weather] = await Promise.all([
    fetchGridStatusSerial(),
    tryGet<WeatherSnapshot>('weather', fetchWeather),
  ])

  const { load, fuel, loadHistory, ercotRt, ercotDa, pjmRt, pjmDa } = gs
  const realtime = load && fuel ? { ...load, ...fuel } : null
  const partial = !realtime || !weather || !ercotRt || !pjmRt || loadHistory.length === 0

  return {
    realtime,
    pricing: {
      ercot: { realtime: ercotRt, day_ahead: ercotDa },
      pjm: { realtime: pjmRt, day_ahead: pjmDa },
    },
    weather,
    load_history: loadHistory,
    fetched_at: new Date().toISOString(),
    partial,
    rate_limited: false,
    served_from_cache: false,
  }
}

async function getSnapshot(): Promise<DashboardSnapshot> {
  // Serve from cache if still fresh
  if (cachedSnap && Date.now() < cachedSnap.expiresAt) {
    return { ...cachedSnap.snap, served_from_cache: true }
  }

  // Deduplicate concurrent requests — only one upstream fan-out at a time
  if (inflightFetch) {
    const snap = await inflightFetch
    return { ...snap, served_from_cache: true }
  }

  inflightFetch = buildFreshSnapshot().finally(() => {
    inflightFetch = null
  })

  const snap = await inflightFetch
  cachedSnap = { snap, expiresAt: Date.now() + CACHE_TTL_MS }
  return snap
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const snap = await getSnapshot()
    return Response.json(snap, { status: snap.realtime || snap.weather ? 200 : 502 })
  } catch (err) {
    console.error('[api/grid] unhandled:', err)

    // If we have stale cache, serve it with rate_limited flag rather than 502
    if (cachedSnap) {
      const stale: DashboardSnapshot = {
        ...cachedSnap.snap,
        rate_limited: true,
        served_from_cache: true,
      }
      return Response.json(stale, { status: 200 })
    }

    return Response.json(
      { error: 'upstream fetch failed', rate_limited: String(err).includes('429') } as unknown,
      { status: 502 },
    )
  }
}
