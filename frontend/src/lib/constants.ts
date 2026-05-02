import type { GridState, AlarmSeverity, IncidentSeverity } from './types'

export const FREQUENCY_NOMINAL = 60.0
export const FREQUENCY_WARN_LOW = 59.95
export const FREQUENCY_WARN_HIGH = 60.05
export const FREQUENCY_CRIT_LOW = 59.90
export const FREQUENCY_CRIT_HIGH = 60.10
export const FREQUENCY_DISPLAY_MIN = 59.85
export const FREQUENCY_DISPLAY_MAX = 60.15

export const LOAD_MIN_MW = 35000
export const LOAD_MAX_MW = 48000
export const DC_LOAD_WARN_MW = 800
export const DC_LOAD_CRIT_MW = 1200

export const FORECAST_WARN_PCT = 3
export const FORECAST_CRIT_PCT = 5

export const SPARKLINE_POINTS = 30
export const LOAD_HISTORY_POINTS = 72 // 6 hours at 5-min intervals

export const TABS = [
  { id: 'grid-monitor', label: 'Grid Monitor', icon: 'Activity' },
  { id: 'incidents', label: 'Incidents', icon: 'AlertTriangle' },
  { id: 'shift-log', label: 'Shift Log', icon: 'ClipboardList' },
  { id: 'playbook', label: 'Playbook', icon: 'BookOpen' },
  { id: 'analytics', label: 'Analytics', icon: 'BarChart3' },
  { id: 'settings', label: 'Settings', icon: 'Settings2' },
] as const

export type TabId = typeof TABS[number]['id']

export const GRID_STATE_COLORS: Record<GridState, string> = {
  nominal: 'var(--accent-green)',
  watch: 'var(--accent-amber)',
  alert: 'var(--accent-red)',
  critical: 'var(--accent-red)',
}

export const ALARM_SEVERITY_COLORS: Record<AlarmSeverity, string> = {
  critical: 'var(--accent-red)',
  major:    'var(--accent-amber)',
  minor:    'var(--accent-cyan)',
  info:     'var(--accent-indigo)',
}

export const INCIDENT_SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  critical: 'var(--accent-red)',
  major:    'var(--accent-amber)',
  minor:    'var(--accent-cyan)',
  info:     'var(--accent-indigo)',
}

export const AGENT_STATUS_LABELS = {
  monitoring: 'Monitoring',
  analyzing:  'Analyzing',
  drafting:   'Drafting',
  alert:      'ALERT',
} as const

export const AGENT_STATUS_COLORS = {
  monitoring: 'var(--accent-green)',
  analyzing:  'var(--accent-cyan)',
  drafting:   'var(--accent-indigo)',
  alert:      'var(--accent-red)',
} as const
