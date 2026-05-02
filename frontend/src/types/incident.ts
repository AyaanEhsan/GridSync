export type IncidentSeverity = 'critical' | 'major' | 'minor' | 'info'
export type IncidentType = 'frequency' | 'voltage' | 'overload' | 'weather' | 'cyber' | 'renewable' | 'cascading' | 'datacenter'
export type IncidentStatus = 'active' | 'under_review' | 'resolved'

export interface ActionTaken {
  timestamp: number
  action: string
  operator?: string
}

export interface Incident {
  id: string
  nercId?: string
  date: number
  type: IncidentType
  region: string
  severity: IncidentSeverity
  duration: number
  loadImpact: number
  status: IncidentStatus
  narrative: string
  actionsTaken: ActionTaken[]
  outcome: string
  similarityScore?: number
}

export interface IncidentFilter {
  search: string
  severity?: IncidentSeverity
  type?: IncidentType
  dateRange?: { from: number; to: number }
  region?: string
}

export interface Precedent {
  nercId: string
  date: number
  similarity: number
  description: string
  operatorAction: string
  outcome: string
  incidentId?: string
}
