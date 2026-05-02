import type { FrequencyDataPoint, LoadDataPoint, Alarm, BalancingAuthority, WeatherCell, SparklinePoint } from '../types'

let frequencyPhase = 0
let perturbationTimer = 0
let perturbationValue = 0
let perturbationDuration = 0

function gaussianNoise(stddev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return z0 * stddev
}

export function generateNextFrequency(): number {
  frequencyPhase += 0.02

  if (perturbationDuration > 0) {
    perturbationDuration--
    if (perturbationDuration === 0) perturbationValue = 0
  } else if (Math.random() < 0.002) {
    perturbationValue = (Math.random() - 0.5) * 0.08
    perturbationDuration = Math.floor(Math.random() * 120) + 30
  }

  perturbationTimer++
  const base = 60.0 + Math.sin(frequencyPhase * 0.1) * 0.003
  const noise = gaussianNoise(0.0015)
  const pert = perturbationDuration > 0
    ? perturbationValue * Math.sin((perturbationTimer / perturbationDuration) * Math.PI)
    : 0

  return Math.max(59.80, Math.min(60.20, base + noise + pert))
}

export function generateFrequencyHistory(points: number, nowMs: number = Date.now()): FrequencyDataPoint[] {
  const intervalMs = 1000
  const result: FrequencyDataPoint[] = []
  let phase = Math.random() * Math.PI * 2

  for (let i = points - 1; i >= 0; i--) {
    phase += 0.02
    const base = 60.0 + Math.sin(phase * 0.1) * 0.003
    const noise = gaussianNoise(0.0015)
    result.push({
      timestamp: nowMs - i * intervalMs,
      value: Math.max(59.80, Math.min(60.20, base + noise)),
    })
  }
  return result
}

export function generateFrequencySparkline(points = 30): SparklinePoint[] {
  return generateFrequencyHistory(points).map(p => ({ timestamp: p.timestamp, value: p.value }))
}

export function generateLoadCurve(points: number, nowMs: number = Date.now()): LoadDataPoint[] {
  const intervalMs = 5 * 60 * 1000 // 5 minutes
  const result: LoadDataPoint[] = []

  for (let i = points - 1; i >= 0; i--) {
    const ts = nowMs - i * intervalMs
    const hour = new Date(ts).getHours() + new Date(ts).getMinutes() / 60
    const dailyCycle = Math.cos(((hour - 14) / 12) * Math.PI) // peaks at 2PM
    const base = 41000 + dailyCycle * 7000
    const noise = gaussianNoise(300)
    const actual = Math.max(LOAD_MIN, Math.min(LOAD_MAX, base + noise))
    const forecastError = gaussianNoise(600) + (Math.random() - 0.5) * 400
    const forecast = actual + forecastError

    result.push({ timestamp: ts, actual, forecast })
  }
  return result
}

const LOAD_MIN = 35000
const LOAD_MAX = 48000

export function generateLoadSparkline(points = 30): SparklinePoint[] {
  const now = Date.now()
  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60
  const base = 41000 + Math.cos(((hour - 14) / 12) * Math.PI) * 7000

  return Array.from({ length: points }, (_, i) => ({
    timestamp: now - (points - 1 - i) * 60000,
    value: Math.max(LOAD_MIN, Math.min(LOAD_MAX, base + gaussianNoise(400))),
  }))
}

export function generateDCLoadSparkline(points = 30): SparklinePoint[] {
  const base = 1100
  return Array.from({ length: points }, (_, i) => ({
    timestamp: Date.now() - (points - 1 - i) * 60000,
    value: Math.max(800, Math.min(1400, base + gaussianNoise(80))),
  }))
}

export function generateAlarm(): Alarm {
  const severities: Alarm['severity'][] = ['critical', 'major', 'minor', 'info']
  const severityWeights = [0.05, 0.15, 0.5, 0.3]
  const rand = Math.random()
  let cumulative = 0
  let severity: Alarm['severity'] = 'info'
  for (let i = 0; i < severities.length; i++) {
    cumulative += severityWeights[i]
    if (rand < cumulative) { severity = severities[i]; break }
  }

  const regions = ['CAISO', 'ERCOT', 'PJM', 'MISO', 'SPP', 'WECC', 'SERC']
  const descriptions = [
    'Frequency deviation exceeding ±0.03 Hz threshold',
    'Unit 7 output dropped unexpectedly — checking telemetry',
    'Transmission line TX-042 approaching thermal limit',
    'Renewable generation ramp rate exceeds forecast by 18%',
    'Data center load spike detected in Ashburn corridor',
    'Voltage sag reported on 500kV bus — investigating',
    'Load shedding probability elevated in eastern sub-region',
    'AGC signal deviation — checking regulation reserve',
    'Wind curtailment event initiated — excess generation',
    'Demand response program activation in progress',
  ]

  return {
    id: `ALM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    severity,
    region: regions[Math.floor(Math.random() * regions.length)],
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    timestamp: Date.now(),
    acknowledged: false,
  }
}

export const BALANCING_AUTHORITIES: BalancingAuthority[] = [
  { id: 'CAISO', name: 'California ISO', shortName: 'CAISO', currentLoad: 28500, capacity: 45000, region: 'West' },
  { id: 'ERCOT', name: 'Electric Reliability Council of Texas', shortName: 'ERCOT', currentLoad: 42000, capacity: 87000, region: 'South' },
  { id: 'PJM', name: 'PJM Interconnection', shortName: 'PJM', currentLoad: 98000, capacity: 180000, region: 'East' },
  { id: 'MISO', name: 'Midcontinent ISO', shortName: 'MISO', currentLoad: 72000, capacity: 135000, region: 'Central' },
  { id: 'SPP', name: 'Southwest Power Pool', shortName: 'SPP', currentLoad: 38000, capacity: 85000, region: 'Central' },
  { id: 'NYISO', name: 'New York ISO', shortName: 'NYISO', currentLoad: 18500, capacity: 38000, region: 'East' },
  { id: 'ISONE', name: 'ISO New England', shortName: 'ISONE', currentLoad: 12000, capacity: 32000, region: 'East' },
  { id: 'WECC', name: 'Western Electricity Coord. Council', shortName: 'WECC', currentLoad: 62000, capacity: 120000, region: 'West' },
]

export const MOCK_WEATHER_CELLS: WeatherCell[] = [
  { id: 'w1', lat: 32.5, lon: -97.3, type: 'storm', intensity: 0.7, label: 'TS-14' },
  { id: 'w2', lat: 38.5, lon: -105.0, type: 'wind', intensity: 0.5, label: '45 mph' },
  { id: 'w3', lat: 41.0, lon: -88.0, type: 'temperature', intensity: 0.6, label: '+8°F' },
  { id: 'w4', lat: 35.5, lon: -119.0, type: 'wind', intensity: 0.4, label: '28 mph' },
  { id: 'w5', lat: 28.0, lon: -82.5, type: 'storm', intensity: 0.9, label: 'TS-09' },
]
