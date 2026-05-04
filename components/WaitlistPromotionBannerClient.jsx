'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const DISMISS_KEY = 'wl-promo-dismissed-v1'

// 24h in millisecondi: deadline standard per completare il pagamento di
// un booking pending nato da promozione waitlist (BUG-041, BUG-046).
const PROMOTE_TTL_MS = 24 * 60 * 60 * 1000

function formatRemaining(ms) {
  if (ms <= 0) return 'scaduto'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h >= 1) return `${h}h ${m}m`
  return `${m} min`
}

function readDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch (_) {
    return new Set()
  }
}

function writeDismissed(set) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]))
  } catch (_) {}
}

/**
 * @typedef {Object} PromotedBooking
 * @property {string} id
 * @property {string} eventTitle
 * @property {string} eventDate     - ISO date string (YYYY-MM-DD)
 * @property {string} stallLabel
 * @property {string|null} promotedAt - ISO timestamp
 * @property {number} paidPrice     - prezzo congelato (BUG-047)
 */

/**
 * Banner persistente in cima al sito: una card per ogni booking pending
 * promosso da waitlist. CTA principale "Vai al profilo" → flow di completamento
 * via CompleteBookingButton. Dismiss persistente per id (localStorage),
 * cosi' non riappare ad ogni navigation page.
 *
 * @param {{ bookings: PromotedBooking[] }} props
 */
export default function WaitlistPromotionBannerClient({ bookings }) {
  const [dismissed, setDismissed] = useState(() => new Set())
  const [now, setNow] = useState(() => Date.now())

  // Carica dismiss list dopo mount (localStorage non e' SSR-safe).
  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  // Tick ogni 60s per aggiornare i countdown. 60s e' sufficiente: la
  // deadline e' di ore, niente animazioni "live" al secondo.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const handleDismiss = (id) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    writeDismissed(next)
  }

  // Filter dismissed + scaduti (deadline = promoted_at + 24h).
  const visible = useMemo(() => {
    return bookings.filter(b => {
      if (dismissed.has(b.id)) return false
      if (!b.promotedAt) return true // edge: pending senza promoted_at, mostra comunque
      const deadline = new Date(b.promotedAt).getTime() + PROMOTE_TTL_MS
      return deadline - now > 0
    })
  }, [bookings, dismissed, now])

  if (visible.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notifiche posti liberati"
      className="bg-amber-50 border-b border-amber-200"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 space-y-2">
        {visible.map(b => {
          const deadline = b.promotedAt
            ? new Date(b.promotedAt).getTime() + PROMOTE_TTL_MS
            : null
          const remainingMs = deadline ? deadline - now : null
          const urgent = remainingMs !== null && remainingMs < 4 * 60 * 60 * 1000

          return (
            <div
              key={b.id}
              className="flex items-start sm:items-center gap-3 flex-col sm:flex-row"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-amber-900">
                  <span aria-hidden="true">🎉</span>{' '}
                  Si è liberato un posto per <span className="font-semibold">{b.eventTitle}</span>
                  {b.stallLabel && (
                    <> · posteggio <span className="font-mono">{b.stallLabel}</span></>
                  )}
                </div>
                <div className="text-xs text-amber-800 mt-0.5">
                  {b.paidPrice > 0
                    ? <>Importo da pagare: <strong>{b.paidPrice}€</strong></>
                    : <>Prenotazione gratuita: basta confermare</>
                  }
                  {remainingMs !== null && (
                    <>
                      {' · '}
                      <span className={urgent ? 'font-semibold text-red-700' : ''}>
                        Tempo rimasto: {formatRemaining(remainingMs)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
                <Link
                  href={`/prenotato/${b.id}`}
                  className="text-xs sm:text-sm rounded-lg px-3 py-1.5 text-white font-medium no-underline whitespace-nowrap"
                  style={{ background: '#BA7517' }}
                >
                  Vai al profilo →
                </Link>
                <button
                  type="button"
                  onClick={() => handleDismiss(b.id)}
                  className="text-amber-700 hover:text-amber-900 text-xs px-2 py-1 rounded transition-colors"
                  aria-label={`Nascondi notifica per ${b.eventTitle}`}
                >
                  Nascondi
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
