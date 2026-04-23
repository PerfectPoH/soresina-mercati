import { NextResponse } from 'next/server'

// GET /api/health
//
// Endpoint di health check per monitoring esterno (UptimeRobot, Better
// Stack, BetterUptime, Pingdom, ecc.). Ritorna 200 se l'app Vercel
// risponde e il DB Supabase risponde entro 5 secondi, altrimenti 503.
//
// Da configurare come "HTTP monitor" nel tuo servizio di uptime:
//   URL:      https://soresina-mercati.vercel.app/api/health
//   Method:   GET
//   Interval: 5 min (free tier UptimeRobot)
//   Expected: HTTP 200 + body contiene "ok"
//
// NOTA: non usiamo `force-dynamic` + auth perche' monitoring esterno
// chiama senza cookie. Leggiamo il DB con l'anon key, facendo una
// query leggerissima su un dato pubblico (count su events attivi).
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const started = Date.now()
  const checks = {
    api: 'ok',
    db:  'unknown',
  }

  // Check DB: lettura leggera su una view pubblica.
  try {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 5000)

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/events?select=id&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      signal: controller.signal,
      cache:  'no-store',
    })
    clearTimeout(timeoutId)

    checks.db = res.ok ? 'ok' : `http_${res.status}`
  } catch (err) {
    checks.db = err?.name === 'AbortError' ? 'timeout' : 'error'
  }

  const healthy = checks.api === 'ok' && checks.db === 'ok'
  const payload = {
    status:    healthy ? 'ok' : 'degraded',
    checks,
    latencyMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(payload, {
    status: healthy ? 200 : 503,
    // Evita che Vercel cachi: ogni chiamata del monitor deve arrivare al codice.
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
