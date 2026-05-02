import type { ShiftEvent, WatchItem } from '../types'

const BASE_TIME = new Date()
BASE_TIME.setHours(22, 0, 0, 0)
BASE_TIME.setDate(BASE_TIME.getDate() - (BASE_TIME.getHours() < 22 ? 1 : 0))

function t(hoursOffset: number, minutesOffset = 0): number {
  return BASE_TIME.getTime() + (hoursOffset * 60 + minutesOffset) * 60 * 1000
}

export const MOCK_SHIFT_EVENTS: ShiftEvent[] = [
  {
    id: 'EVT-001',
    type: 'system',
    timestamp: t(0, 2),
    title: 'Shift started',
    description: 'Night shift commenced. 3 open watches from previous shift. Grid frequency nominal at 60.002 Hz. Load: 41,247 MW.',
  },
  {
    id: 'EVT-002',
    type: 'watt',
    timestamp: t(0, 15),
    title: 'WATT: Load ramp detected',
    description: 'Evening demand ramp detected — +847 MW over 15 minutes. Within forecast envelope. No action required. Monitoring.',
  },
  {
    id: 'EVT-003',
    type: 'alarm',
    timestamp: t(1, 47),
    title: 'Alarm: Frequency deviation +0.04 Hz',
    description: 'Frequency rose to 60.039 Hz following unexpected wind generation surge in WECC. Acknowledged. Returned to nominal within 4 minutes.',
    operatorId: 'Maria K.',
  },
  {
    id: 'EVT-004',
    type: 'note',
    timestamp: t(2, 3),
    title: 'Manual note',
    description: 'Watching TX-NM interchange closely — wind forecast shows potential 800 MW ramp in next 2 hours. Pre-positioned fast-start unit on 15-min notice.',
    operatorId: 'Maria K.',
  },
  {
    id: 'EVT-005',
    type: 'watt',
    timestamp: t(2, 18),
    title: 'WATT recommendation: Pre-emptive reserve',
    description: 'Based on wind forecast and historical precedents, WATT recommends increasing operating reserve by 200 MW ahead of anticipated TX-NM ramp.',
    wattRecommendation: 'Increase operating reserve by 200 MW via fast-start unit UNIT-07',
    approved: true,
    approvedBy: 'Maria K.',
    approvedAt: t(2, 20),
  },
  {
    id: 'EVT-006',
    type: 'operator',
    timestamp: t(2, 20),
    title: 'Decision: Reserve increase approved',
    description: 'Approved WATT recommendation to increase operating reserve by 200 MW. Unit UNIT-07 brought to 15-minute notice.',
    operatorId: 'Maria K.',
  },
  {
    id: 'EVT-007',
    type: 'alarm',
    timestamp: t(3, 1),
    title: 'Alarm: TX-NM interchange deviation',
    description: 'Interchange deviation at TX-NM border: -312 MW from scheduled. Pre-positioned reserve dispatched. Frequency held within ±0.02 Hz throughout.',
    operatorId: 'Maria K.',
  },
  {
    id: 'EVT-008',
    type: 'system',
    timestamp: t(3, 35),
    title: 'TX-NM event resolved',
    description: 'Interchange deviation resolved. Reserve deployment successful. Frequency maintained 59.98–60.01 Hz throughout event. UNIT-07 returning to standby.',
  },
  {
    id: 'EVT-009',
    type: 'watt',
    timestamp: t(4, 45),
    title: 'WATT: Shift summary',
    description: 'Shift summary generated. 2 significant events handled. Average frequency deviation: ±0.019 Hz. Response time: 1m 42s avg. Grid health score: 91/100.',
  },
]

export const MOCK_WATCH_ITEMS: WatchItem[] = [
  {
    id: 'WCH-001',
    description: 'Monitor TX-NM wind generation',
    condition: 'Alert if wind drops below 15 mph in Guadalupe Pass corridor',
    createdAt: t(0, 5),
    active: true,
    createdBy: 'Maria K.',
  },
  {
    id: 'WCH-002',
    description: 'CAISO-WECC tie line thermal margin',
    condition: 'Warning if loading exceeds 85% of thermal rating on Path 26',
    createdAt: t(0, 0),
    active: true,
    createdBy: 'Previous shift',
  },
  {
    id: 'WCH-003',
    description: 'Data center load ramp in Ashburn',
    condition: 'Alert if DC load exceeds 1,200 MW',
    createdAt: t(1, 0),
    active: false,
    createdBy: 'Maria K.',
  },
]

export const MOCK_SHIFT_INFO = {
  shiftName: 'Night Shift',
  operatorName: 'Maria K.',
  shiftStart: BASE_TIME.getTime(),
  supervisorName: 'James T.',
}
