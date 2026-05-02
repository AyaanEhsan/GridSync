import { fetchLoadLatest } from '@/lib/gridstatus'
import type { FastLoadSnapshot } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 30

export async function GET() {
  try {
    const realtime_load = await fetchLoadLatest()
    const body: FastLoadSnapshot = {
      realtime_load,
      fetched_at: new Date().toISOString(),
    }
    return Response.json(body)
  } catch (err) {
    console.error('[api/grid/load]', err)
    const body: FastLoadSnapshot = {
      realtime_load: null,
      fetched_at: new Date().toISOString(),
    }
    return Response.json(body, { status: 502 })
  }
}
