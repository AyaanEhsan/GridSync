import { format, formatDistanceToNow } from 'date-fns'
import type { GridState, AlarmSeverity } from './types'
import {
  FREQUENCY_WARN_LOW, FREQUENCY_WARN_HIGH,
  FREQUENCY_CRIT_LOW, FREQUENCY_CRIT_HIGH,
  FORECAST_WARN_PCT, FORECAST_CRIT_PCT,
  ALARM_SEVERITY_COLORS,
} from './constants'

export function formatFrequency(hz: number): string {
  return `${hz.toFixed(2)} Hz`
}

export function formatMW(mw: number): string {
  return `${mw.toLocaleString('en-US')} MW`
}

export function formatDeviation(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatTimestamp(ts: number, fmt = 'HH:mm:ss'): string {
  return format(new Date(ts), fmt)
}

export function formatDate(ts: number): string {
  return format(new Date(ts), 'MMM dd, yyyy')
}

export function formatRelative(ts: number): string {
  return formatDistanceToNow(new Date(ts), { addSuffix: true })
}

export function getGridState(frequency: number, forecastDeviation?: number): GridState {
  if (frequency <= FREQUENCY_CRIT_LOW || frequency >= FREQUENCY_CRIT_HIGH) return 'critical'
  if (frequency <= FREQUENCY_WARN_LOW || frequency >= FREQUENCY_WARN_HIGH) return 'alert'
  if (forecastDeviation !== undefined && Math.abs(forecastDeviation) >= FORECAST_CRIT_PCT) return 'alert'
  if (forecastDeviation !== undefined && Math.abs(forecastDeviation) >= FORECAST_WARN_PCT) return 'watch'
  return 'nominal'
}

export function getFrequencyZone(hz: number): 'nominal' | 'watch' | 'critical' {
  if (hz <= FREQUENCY_CRIT_LOW || hz >= FREQUENCY_CRIT_HIGH) return 'critical'
  if (hz <= FREQUENCY_WARN_LOW || hz >= FREQUENCY_WARN_HIGH) return 'watch'
  return 'nominal'
}

export function getSeverityColor(severity: AlarmSeverity): string {
  return ALARM_SEVERITY_COLORS[severity]
}

export function formatShiftTime(ts: number): string {
  return format(new Date(ts), 'hh:mm a')
}

export function formatShiftDate(ts: number): string {
  return format(new Date(ts), 'EEE, MMM d')
}
