export const dynamic = 'force-dynamic'

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:8000'

function backendUrl(): string {
  return process.env.BACKEND_API_BASE_URL ?? DEFAULT_BACKEND_BASE_URL
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ detail: 'Invalid JSON payload.' }, { status: 400 })
  }

  const message = (payload as { message?: unknown })?.message
  if (typeof message !== 'string' || !message.trim()) {
    return Response.json({ detail: '`message` must be a non-empty string.' }, { status: 400 })
  }

  const upstream = await fetch(`${backendUrl()}/agent/main/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    cache: 'no-store',
  })

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => 'Upstream stream failed.')
    return Response.json({ detail }, { status: upstream.status || 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

