import type { DashboardSnapshot, FastLoadSnapshot } from '@/lib/types'

export async function fetchDashboardSnapshot(signal?: AbortSignal): Promise<DashboardSnapshot> {
  const res = await fetch('/api/grid', { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`/api/grid → ${res.status}`)
  return (await res.json()) as DashboardSnapshot
}

export async function fetchFastLoad(signal?: AbortSignal): Promise<FastLoadSnapshot> {
  const res = await fetch('/api/grid/load', { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`/api/grid/load → ${res.status}`)
  return (await res.json()) as FastLoadSnapshot
}

export async function generateHandoffBrief(shiftData: unknown) {
  const res = await fetch('/api/handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shiftData),
  })
  if (!res.ok) throw new Error('Failed to generate handoff brief')
  return res.blob()
}
