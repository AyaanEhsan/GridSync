'use client'

import { create } from 'zustand'
import type { Incident, IncidentFilter } from '@/lib/types'
import { MOCK_INCIDENTS } from '@/lib/mock-data/incidentData'

interface IncidentStore {
  incidents: Incident[]
  filters: IncidentFilter
  selectedIncidentId: string | null
  setFilters: (filters: Partial<IncidentFilter>) => void
  setSelectedIncident: (id: string | null) => void
  addIncident: (incident: Incident) => void
  getFilteredIncidents: () => Incident[]
}

export const useIncidentStore = create<IncidentStore>()((set, get) => ({
  incidents: MOCK_INCIDENTS,
  filters: { search: '' },
  selectedIncidentId: null,

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  setSelectedIncident: (id) => set({ selectedIncidentId: id }),

  addIncident: (incident) =>
    set((state) => ({ incidents: [incident, ...state.incidents] })),

  getFilteredIncidents: () => {
    const { incidents, filters } = get()
    return incidents.filter((inc) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (
          !inc.narrative.toLowerCase().includes(q) &&
          !inc.region.toLowerCase().includes(q) &&
          !inc.type.toLowerCase().includes(q) &&
          !(inc.nercId?.toLowerCase().includes(q))
        ) return false
      }
      if (filters.severity && inc.severity !== filters.severity) return false
      if (filters.type && inc.type !== filters.type) return false
      if (filters.region && inc.region !== filters.region) return false
      if (filters.dateRange) {
        if (inc.date < filters.dateRange.from || inc.date > filters.dateRange.to) return false
      }
      return true
    })
  },
}))
