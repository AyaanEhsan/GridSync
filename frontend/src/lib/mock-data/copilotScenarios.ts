import type { CopilotMessage } from '../types'

function id() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const INITIAL_MESSAGES: CopilotMessage[] = [
  {
    id: id(),
    type: 'system',
    timestamp: Date.now() - 240000,
    content: 'WATT Grid Co-Pilot initialized. MONITOR agent active.',
  },
  {
    id: id(),
    type: 'system',
    timestamp: Date.now() - 180000,
    content: 'Grid status: nominal. Frequency 60.002 Hz. Load 41,247 MW. 0 active critical alarms.',
  },
]

export const JULY10_SCENARIO_STEPS = [
  {
    delay: 500,
    message: (): CopilotMessage => ({
      id: id(),
      type: 'alert',
      timestamp: Date.now(),
      content: 'Frequency excursion detected: 59.934 Hz — below NERC watch threshold (59.95 Hz). Initiating DIAGNOSE.',
      alertSeverity: 'warning',
    }),
  },
  {
    delay: 2000,
    message: (): CopilotMessage => ({
      id: id(),
      type: 'streaming',
      timestamp: Date.now(),
      content: 'Retrieving similar incidents from historical database. Searching by frequency deviation pattern, time-of-day, BA of origin...',
      isStreaming: true,
    }),
  },
  {
    delay: 4000,
    message: (): CopilotMessage => ({
      id: id(),
      type: 'precedent',
      timestamp: Date.now(),
      precedents: [
        {
          nercId: 'NERC-2021-0910-ERC',
          date: new Date('2021-09-10').getTime(),
          similarity: 0.88,
          description: 'ERCOT IBR cascade: 59.71 Hz nadir following multi-unit solar trip',
          operatorAction: 'Emergency reserve dispatch + shunt cap removal',
          outcome: 'Recovered in 78 min — UFLS narrowly avoided',
        },
        {
          nercId: 'NERC-2022-1115-CAI',
          date: new Date('2022-11-15').getTime(),
          similarity: 0.82,
          description: 'CAISO evening ramp: 59.92 Hz following wind underperformance',
          operatorAction: 'Fast-start dispatch + import increase from WECC',
          outcome: 'Frequency recovered in 12 min',
        },
        {
          nercId: 'NERC-2023-0303-PJM',
          date: new Date('2023-03-03').getTime(),
          similarity: 0.79,
          description: 'PJM cold-weather unit trip: 59.90 Hz, 1,800 MW deficit',
          operatorAction: 'Emergency capacity contract activation',
          outcome: 'Frequency stabilized in 18 min',
        },
      ],
    }),
  },
  {
    delay: 6000,
    message: (): CopilotMessage => ({
      id: id(),
      type: 'streaming',
      timestamp: Date.now(),
      content: 'Analyzing current grid state against precedent patterns. Root cause hypothesis: IBR fault in WECC — 3 wind units tripped simultaneously. Confidence: 87%.',
      isStreaming: true,
    }),
  },
  {
    delay: 9000,
    message: (): CopilotMessage => ({
      id: id(),
      type: 'recommendation',
      timestamp: Date.now(),
      recommendation: {
        situation: 'Frequency deviation to 59.934 Hz detected. Probable cause: simultaneous IBR trip in WECC — consistent with Odessa 2021 pattern. AGC response active but insufficient.',
        action: 'Remove shunt capacitor banks on 500kV bus CAISO-South (CAP-07A, CAP-07B). Dispatch fast-start Unit 3 at Palomar — 220 MW available in 8 minutes. Request 400 MW emergency import from LADWP.',
        confidence: 0.84,
        estimatedRecovery: '12–18 minutes',
        loadShedRisk: 4.2,
        customersAtRisk: 142000,
        status: 'pending',
      },
    }),
  },
]

export const SAMPLE_OPERATOR_RESPONSES = [
  'What similar events have we seen in ERCOT this summer?',
  'Is the frequency still trending down?',
  'How long until the fast-start unit is ready?',
  'Should I call WECC operations center?',
]
