import type { DashboardSnapshot, GridMetrics, LMPRow, WeatherSnapshot } from '@/lib/types'

interface DemoMetricsPayload {
  captured_at_iso: string
  dashboard_fetched_at: string | null
  grid_metrics: {
    frequency_hz: number
    load_mw: number
    forecast_load_mw: number
    forecast_deviation_pct: number
    alarm_count: number
  }
  pricing: {
    ercot_realtime_lmp: number | null
    pjm_realtime_lmp: number | null
  }
  weather: {
    temperature_c: number | null
    wind_speed_ms: number | null
    solar_irradiance_wm2: number | null
    precipitation_mm: number | null
  }
  operational_flags: {
    demo_mode: boolean
    partial_snapshot: boolean
    rate_limited: boolean
  }
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function lmpValue(row: LMPRow | null | undefined): number | null {
  return numberOrNull(row?.lmp)
}

function weatherShape(weather: WeatherSnapshot | null | undefined): DemoMetricsPayload['weather'] {
  return {
    temperature_c: numberOrNull(weather?.temperature_c),
    wind_speed_ms: numberOrNull(weather?.wind_speed_ms),
    solar_irradiance_wm2: numberOrNull(weather?.solar_irradiance_wm2),
    precipitation_mm: numberOrNull(weather?.precipitation_mm),
  }
}

export function buildRunDemoMessage(args: {
  metrics: GridMetrics
  snapshot: DashboardSnapshot | null
  demoMode: boolean
}): string {
  const { metrics, snapshot, demoMode } = args
  const payload: DemoMetricsPayload = {
    captured_at_iso: new Date().toISOString(),
    dashboard_fetched_at: snapshot?.fetched_at ?? null,
    grid_metrics: {
      frequency_hz: metrics.frequency,
      load_mw: metrics.load,
      forecast_load_mw: metrics.forecastLoad,
      forecast_deviation_pct: metrics.forecastDeviation,
      alarm_count: metrics.alarmCount,
    },
    pricing: {
      ercot_realtime_lmp: lmpValue(snapshot?.pricing.ercot.realtime),
      pjm_realtime_lmp: lmpValue(snapshot?.pricing.pjm.realtime),
    },
    weather: weatherShape(snapshot?.weather),
    operational_flags: {
      demo_mode: demoMode,
      partial_snapshot: Boolean(snapshot?.partial),
      rate_limited: Boolean(snapshot?.rate_limited),
    },
  }

  return [
    'You are analyzing current grid metrics from Run Demo.',
    'Provide concise operational insights, potential anomalies, and immediate operator focus areas.',
    `MetricsSnapshot: ${JSON.stringify(payload)}`,
  ].join('\n')
}

