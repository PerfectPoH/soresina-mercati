// Rate limiter in-memory con finestra scorrevole (sliding window).
//
// PRO:
//   - Zero dipendenze, zero infrastruttura extra
//   - Basta per un volume tipico (Pro Loco comunale)
// CONTRO:
//   - Lo stato e' per-processo. Su Vercel serverless ogni funzione puo'
//     avere memoria sua, il limite effettivo e' quindi meno rigido di
//     quanto dice il codice. Va bene come primo strato difensivo:
//     ferma script automatici e abuso banale, non un attaccante
//     distribuito. Per protezione forte serve Upstash/Redis.
//
// Uso:
//   const ok = await rateLimit({ key: ip, limit: 5, windowMs: 60_000 })
//   if (!ok.allowed) return 429

import { NextResponse } from 'next/server'

const buckets = new Map() // key -> number[] (timestamps in ms)

// Pulizia periodica per evitare accumulo di IP vecchi.
// Facciamo il GC opportunistico ogni volta che la mappa cresce troppo.
function gc(nowMs, maxWindowMs) {
  if (buckets.size < 1000) return
  for (const [k, arr] of buckets) {
    const filtered = arr.filter(t => nowMs - t < maxWindowMs)
    if (filtered.length === 0) buckets.delete(k)
    else buckets.set(k, filtered)
  }
}

/**
 * @param {object} opts
 * @param {string} opts.key       - identificatore (tipicamente IP, oppure IP+userId)
 * @param {number} opts.limit     - max richieste nella finestra
 * @param {number} opts.windowMs  - durata finestra in ms
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function rateLimit({ key, limit, windowMs }) {
  if (!key) return { allowed: true, remaining: limit, retryAfterMs: 0 }
  const now = Date.now()
  gc(now, windowMs)

  const arr       = buckets.get(key) || []
  const fresh     = arr.filter(t => now - t < windowMs)
  const allowed   = fresh.length < limit
  const remaining = Math.max(0, limit - fresh.length - (allowed ? 1 : 0))

  if (allowed) {
    fresh.push(now)
    buckets.set(key, fresh)
    return { allowed: true, remaining, retryAfterMs: 0 }
  }

  const oldest       = fresh[0]
  const retryAfterMs = Math.max(0, windowMs - (now - oldest))
  return { allowed: false, remaining: 0, retryAfterMs }
}

// Estrae l'IP del client dalla Request. In produzione (Vercel/Netlify)
// arriva in `x-forwarded-for` o `x-real-ip`.
export function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const xr = request.headers.get('x-real-ip')
  if (xr) return xr.trim()
  return 'unknown'
}

// Helper di comodo che fa il check + restituisce una NextResponse 429 pronta
// da ritornare. Se allowed==true, ritorna null (continua).
export function enforceRateLimit(request, { prefix, limit, windowMs, keyExtra = '' } = {}) {
  const ip  = getClientIp(request)
  const key = `${prefix}:${ip}${keyExtra ? ':' + keyExtra : ''}`
  const res = rateLimit({ key, limit, windowMs })
  if (res.allowed) return null
  const retryAfter = Math.ceil(res.retryAfterMs / 1000)
  return NextResponse.json(
    {
      error: 'rate_limited',
      message: `Troppe richieste. Riprova tra ${retryAfter}s.`,
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    }
  )
}
