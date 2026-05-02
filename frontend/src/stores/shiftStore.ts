'use client'

import { create } from 'zustand'
import type { ShiftEvent, WatchItem } from '@/lib/types'
import { MOCK_SHIFT_EVENTS, MOCK_WATCH_ITEMS, MOCK_SHIFT_INFO } from '@/lib/mock-data/shiftData'

interface ShiftStore {
  events: ShiftEvent[]
  watches: WatchItem[]
  shiftStart: number
  operatorName: string
  supervisorName: string
  addEvent: (event: ShiftEvent) => void
  addWatch: (watch: WatchItem) => void
  dismissWatch: (id: string) => void
  addNote: (text: string, operatorId?: string) => void
}

export const useShiftStore = create<ShiftStore>()((set, get) => ({
  events: MOCK_SHIFT_EVENTS,
  watches: MOCK_WATCH_ITEMS,
  shiftStart: MOCK_SHIFT_INFO.shiftStart,
  operatorName: MOCK_SHIFT_INFO.operatorName,
  supervisorName: MOCK_SHIFT_INFO.supervisorName,

  addEvent: (event) =>
    set((state) => ({ events: [...state.events, event] })),

  addWatch: (watch) =>
    set((state) => ({ watches: [...state.watches, watch] })),

  dismissWatch: (id) =>
    set((state) => ({
      watches: state.watches.map((w) => (w.id === id ? { ...w, active: false } : w)),
    })),

  addNote: (text, operatorId) => {
    const event: ShiftEvent = {
      id: `EVT-${Date.now()}`,
      type: 'note',
      timestamp: Date.now(),
      title: 'Manual note',
      description: text,
      operatorId: operatorId ?? get().operatorName,
    }
    get().addEvent(event)
  },
}))
