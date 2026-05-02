export type ShiftEventType = 'system' | 'watt' | 'alarm' | 'operator' | 'note' | 'critical' | 'watch'

export interface ShiftEvent {
  id: string
  type: ShiftEventType
  timestamp: number
  title: string
  description: string
  operatorId?: string
  wattRecommendation?: string
  approved?: boolean
  approvedBy?: string
  approvedAt?: number
  expanded?: boolean
}

export interface WatchItem {
  id: string
  description: string
  condition: string
  createdAt: number
  active: boolean
  createdBy?: string
}

export interface Decision {
  id: string
  timestamp: number
  description: string
  rationale: string
  affectedUnits: string[]
  operatorId: string
}
