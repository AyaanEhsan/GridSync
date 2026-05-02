export type GridState = 'nominal' | 'watch' | 'alert' | 'critical'

export interface FrequencyDataPoint {
  timestamp: number
  value: number
}

export interface SparklinePoint {
  timestamp: number
  value: number
}

export interface LoadDataPoint {
  timestamp: number
  actual: number
  forecast: number
}

export interface GridMetrics {
  frequency: number
  load: number
  forecastLoad: number
  forecastDeviation: number
  alarmCount: number
  dcLoad: number
  timestamp: number
}

export type AlarmSeverity = 'critical' | 'major' | 'minor' | 'info'

export interface Alarm {
  id: string
  severity: AlarmSeverity
  region: string
  description: string
  timestamp: number
  acknowledged: boolean
  source?: string
}

export interface BalancingAuthority {
  id: string
  name: string
  shortName: string
  currentLoad: number
  capacity: number
  region: string
}

export interface WeatherCell {
  id: string
  lat: number
  lon: number
  type: 'storm' | 'wind' | 'temperature'
  intensity: number
  label: string
}
