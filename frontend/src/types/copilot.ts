import type { Precedent } from './incident'

export type AgentStatus = 'monitoring' | 'analyzing' | 'drafting' | 'alert'
export type MessageType =
  | 'system'
  | 'alert'
  | 'streaming'
  | 'precedent'
  | 'recommendation'
  | 'operator'
  | 'escalation'
  | 'agent_error'

export interface Recommendation {
  situation: string
  action: string
  confidence: number
  estimatedRecovery: string
  loadShedRisk: number
  customersAtRisk: number
  status: 'pending' | 'approved' | 'modified' | 'rejected'
  modifiedAction?: string
  approvedBy?: string
  approvedAt?: number
}

export interface EscalationOption {
  id: string
  label: string
}

export interface CopilotMessage {
  id: string
  type: MessageType
  timestamp: number
  content?: string
  isStreaming?: boolean
  streamedText?: string
  precedents?: Precedent[]
  recommendation?: Recommendation
  operatorName?: string
  escalationOptions?: EscalationOption[]
  selectedOption?: string
  alertSeverity?: 'warning' | 'critical'
  retryable?: boolean
}

export interface StreamingState {
  isStreaming: boolean
  text: string
  complete: boolean
}
