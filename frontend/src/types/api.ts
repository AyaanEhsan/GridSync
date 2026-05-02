export interface ERCOTLoadRow {
  interval_start_utc: string
  interval_end_utc: string
  load: number
}

export interface FuelMixRow {
  interval_start_utc: string
  natural_gas: number
  coal_and_lignite: number
  nuclear: number
  wind: number
  solar: number
  hydro: number
  power_storage: number
  other: number
}

export interface LMPRow {
  interval_start_utc: string
  location: string
  location_type?: string
  lmp: number
  energy: number
  congestion: number
  loss: number
}

export interface WeatherSnapshot {
  timestamp_utc: string
  temperature_c: number
  wind_speed_ms: number
  wind_direction_deg: number
  solar_irradiance_wm2: number
  precipitation_mm: number
}

export interface DashboardRealtime extends ERCOTLoadRow, FuelMixRow {}

export interface DashboardPricing {
  ercot: { realtime: LMPRow | null; day_ahead: LMPRow[] }
  pjm: { realtime: LMPRow | null; day_ahead: LMPRow[] }
}

export interface DashboardSnapshot {
  realtime: DashboardRealtime | null
  pricing: DashboardPricing
  weather: WeatherSnapshot | null
  load_history: ERCOTLoadRow[]
  fetched_at: string
  partial: boolean
  rate_limited?: boolean
  served_from_cache?: boolean
}

export interface FastLoadSnapshot {
  realtime_load: ERCOTLoadRow | null
  fetched_at: string
}
