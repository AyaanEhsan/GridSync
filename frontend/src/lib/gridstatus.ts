import 'server-only'
import type {
  ERCOTLoadRow,
  FuelMixRow,
  LMPRow,
  WeatherSnapshot,
} from '@/lib/types'

const BASE = 'https://api.gridstatus.io/v1/datasets'

interface GsResponse<T> {
  data: T[]
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function ensureKey(): string {
  const k = process.env.GRIDSTATUS_API_KEY
  if (!k) throw new Error('GRIDSTATUS_API_KEY not set')
  return k
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function gs<T>(
  dataset: string,
  params: Record<string, string>,
  attempt = 0,
): Promise<T[]> {
  const url = new URL(`${BASE}/${dataset}/query`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': ensureKey() },
    cache: 'no-store',
  })

  if (res.status === 429) {
    if (attempt >= 1) {
      const body = await res.text().catch(() => '')
      throw new Error(`GridStatus [${dataset}] 429: ${body.slice(0, 160)}`)
    }
    // Honour Retry-After header when present, otherwise backoff 2s
    const retryAfterRaw = res.headers.get('retry-after')
    const waitMs = retryAfterRaw ? Math.max(parseInt(retryAfterRaw, 10) * 1000, 1100) : 2200
    await sleep(waitMs)
    return gs<T>(dataset, params, attempt + 1)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GridStatus [${dataset}] ${res.status}: ${body.slice(0, 160)}`)
  }
  const json: unknown = await res.json()
  if (!isObj(json) || !Array.isArray((json as { data?: unknown }).data)) {
    throw new Error(`GridStatus [${dataset}] malformed response`)
  }
  return (json as unknown as GsResponse<T>).data
}

function isoMinsAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60_000).toISOString()
}

// ── Module-level cache for ercot_load ─────────────────────────────────────────
// Both /api/grid and /api/grid/load call fetchLoadLatest. Without a shared
// cache they race on startup and exhaust the "1 per 1 second" rate limit.
// Cache TTL is 25s — safely below the 30s client fast-poll interval.
const LOAD_CACHE_TTL = 25_000
let _loadLatestCache: { row: ERCOTLoadRow; expiresAt: number } | null = null
let _loadLatestInflight: Promise<ERCOTLoadRow> | null = null

function coerceERCOTLoadRow(r: unknown): ERCOTLoadRow {
  if (!isObj(r) || typeof r.interval_start_utc !== 'string' || !isFiniteNumber(r.load)) {
    throw new Error('ERCOTLoadRow shape mismatch')
  }
  return {
    interval_start_utc: r.interval_start_utc,
    interval_end_utc: typeof r.interval_end_utc === 'string' ? r.interval_end_utc : r.interval_start_utc,
    load: r.load,
  }
}

function coerceFuelMixRow(r: unknown): FuelMixRow {
  if (!isObj(r) || typeof r.interval_start_utc !== 'string') {
    throw new Error('FuelMixRow shape mismatch')
  }
  const n = (k: string): number => (isFiniteNumber(r[k]) ? (r[k] as number) : 0)
  return {
    interval_start_utc: r.interval_start_utc,
    natural_gas: n('natural_gas'),
    coal_and_lignite: n('coal_and_lignite'),
    nuclear: n('nuclear'),
    wind: n('wind'),
    solar: n('solar'),
    hydro: n('hydro'),
    power_storage: n('power_storage'),
    other: n('other'),
  }
}

function coerceLMPRow(r: unknown): LMPRow {
  if (
    !isObj(r) ||
    typeof r.interval_start_utc !== 'string' ||
    typeof r.location !== 'string'
  ) {
    throw new Error('LMPRow shape mismatch')
  }
  // ERCOT day-ahead uses `spp` instead of `lmp`
  const lmp = isFiniteNumber(r.lmp) ? r.lmp : isFiniteNumber(r.spp) ? (r.spp as number) : 0
  return {
    interval_start_utc: r.interval_start_utc,
    location: r.location,
    location_type: typeof r.location_type === 'string' ? r.location_type : undefined,
    lmp,
    energy: isFiniteNumber(r.energy) ? r.energy : lmp,
    congestion: isFiniteNumber(r.congestion) ? r.congestion : 0,
    loss: isFiniteNumber(r.loss) ? r.loss : 0,
  }
}

// ercot_load has no `time=latest`; fetch a recent window and take the last row.
// Uses a module-level cache + inflight dedup to prevent concurrent callers
// (both route handlers) from each firing a request within the same second.
export async function fetchLoadLatest(): Promise<ERCOTLoadRow> {
  if (_loadLatestCache && Date.now() < _loadLatestCache.expiresAt) {
    return _loadLatestCache.row
  }
  if (_loadLatestInflight) return _loadLatestInflight

  _loadLatestInflight = (async () => {
    const rows = await gs<unknown>('ercot_load', {
      start_time: isoMinsAgo(30),
      limit: '12',
    })
    if (rows.length === 0) throw new Error('ercot_load: no rows in last 30 min')
    const row = coerceERCOTLoadRow(rows[rows.length - 1])
    _loadLatestCache = { row, expiresAt: Date.now() + LOAD_CACHE_TTL }
    return row
  })().finally(() => { _loadLatestInflight = null })

  return _loadLatestInflight
}

export async function fetchLoadWindow(hoursBack: number): Promise<ERCOTLoadRow[]> {
  const rows = await gs<unknown>('ercot_load', {
    start_time: isoHoursAgo(hoursBack),
    end_time: new Date().toISOString(),
    limit: '200',
  })
  return rows.map(coerceERCOTLoadRow)
}

export async function fetchFuelMix(): Promise<FuelMixRow> {
  const rows = await gs<unknown>('ercot_fuel_mix', { time: 'latest', limit: '1' })
  if (rows.length === 0) throw new Error('ercot_fuel_mix: empty response')
  return coerceFuelMixRow(rows[0])
}

export async function fetchERCOTLMPRealtime(): Promise<LMPRow> {
  const rows = await gs<unknown>('ercot_lmp_by_settlement_point', {
    time: 'latest',
    filter_column: 'location',
    filter_value: 'HB_NORTH',
    limit: '1',
  })
  if (rows.length === 0) throw new Error('ercot_lmp: empty response')
  return coerceLMPRow(rows[0])
}

export async function fetchERCOTLMPDayAhead(): Promise<LMPRow[]> {
  const rows = await gs<unknown>('ercot_spp_day_ahead_hourly', {
    start_time: new Date().toISOString(),
    filter_column: 'location',
    filter_value: 'HB_NORTH',
    limit: '24',
  })
  return rows.map(coerceLMPRow)
}

// PJM RTO aggregate doesn't exist in this dataset; use AEP GEN HUB as a
// representative PJM hub price (large, centrally-located, well-traded).
export async function fetchPJMLMPRealtime(): Promise<LMPRow> {
  const rows = await gs<unknown>('pjm_lmp_real_time_5_min', {
    start_time: isoMinsAgo(30),
    filter_column: 'location',
    filter_value: 'AEP GEN HUB',
    limit: '12',
  })
  if (rows.length === 0) throw new Error('pjm_lmp_real_time: empty response')
  return coerceLMPRow(rows[rows.length - 1])
}

export async function fetchPJMLMPDayAhead(): Promise<LMPRow[]> {
  const rows = await gs<unknown>('pjm_lmp_day_ahead_hourly', {
    start_time: new Date().toISOString(),
    filter_column: 'location',
    filter_value: 'AEP GEN HUB',
    limit: '24',
  })
  return rows.map(coerceLMPRow)
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=30.27&longitude=-97.74' +
    '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,direct_normal_irradiance,precipitation' +
    '&wind_speed_unit=ms' +
    '&forecast_days=1'

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const json: unknown = await res.json()

  if (
    !isObj(json) ||
    !isObj(json.hourly) ||
    !Array.isArray(json.hourly.time) ||
    !Array.isArray(json.hourly.temperature_2m)
  ) {
    throw new Error('Open-Meteo malformed response')
  }
  const h = json.hourly as Record<string, unknown[]>
  const idx = Math.min(new Date().getUTCHours(), h.time.length - 1)

  const num = (key: string): number => {
    const v = h[key]?.[idx]
    return isFiniteNumber(v) ? v : 0
  }
  const ts = h.time[idx]
  if (typeof ts !== 'string') throw new Error('Open-Meteo time missing')

  return {
    timestamp_utc: ts,
    temperature_c: num('temperature_2m'),
    wind_speed_ms: num('wind_speed_10m'),
    wind_direction_deg: num('wind_direction_10m'),
    solar_irradiance_wm2: num('direct_normal_irradiance'),
    precipitation_mm: num('precipitation'),
  }
}
