export type PlaybookCategory = 'frequency' | 'voltage' | 'overload' | 'weather' | 'cyber' | 'datacenter' | 'renewable' | 'cascading'

export interface PlaybookStep {
  id: string
  order: number
  title: string
  description: string
  duration: number
  criticalWarning?: string
  precedentRefs?: string[]
}

export interface Playbook {
  id: string
  title: string
  category: PlaybookCategory
  steps: PlaybookStep[]
  lastUsed: number
  wattConfidence: number
  tags: string[]
  description: string
}
