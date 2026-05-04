'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import RequestBookingCancellation from './RequestBookingCancellation'
import CompleteBookingButton from './CompleteBookingButton'

// BUG-050: formatDate vive INSIDE the client component perche' Next.js 14
// non permette di passare function come prop da server component a client
// component (ServerComponentsRender error). Era prima passato come prop
// dal server `app/profilo/page.js`, causando crash di /profilo in preview.
function formatDate(s) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

/**
 * Card singola di una prenotazione nel profilo utente.
 * Designed for: gerarchia chiara (Pentagram), warm palette (Stamen),
 * micro-hover lift sottile (max -2px).
 *
 * Vedi [[Skill-Huashu-Design]] per il razionale.
 *
 * @param {{
 *   booking: any,
 *   classification: { key: string, label: string, color: string },
 * }} props
 */
export default function ProfileBookingCard({ booking, classification }) {
  const b = booking
  const cls = classification
  const price = b.paid_price ?? b.stalls?.price ?? b.events?.price_per_stall ?? 0
  const canRequestCancel = cls.key === 'active' || cls.key === 'pending'
  const title = b.events?.title || (cls.key === 'unknown' ? 'Evento rimosso' : 'Evento')

  const colorClasses = {
    green: 'border-green-200/70 bg-gradient-to-br from-white to-green-50/40',
    amber: 'border-amber-300/70 bg-gradient-to-br from-amber-50/60 to-white shadow-amber-100/40 shadow-md',
    stone: 'border-stone-200 bg-white',
  }
  const accentDot = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    stone: 'bg-stone-300',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={cls.key !== 'cancelled' && cls.key !== 'past' ? { y: -2 } : undefined}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`rounded-2xl border p-5 transition-shadow ${colorClasses[cls.color] || colorClasses.stone}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${accentDot[cls.color]}`} aria-hidden="true" />
            <span className="text-[10px] uppercase tracking-wider font-medium text-stone-500">
              {cls.label}
            </span>
          </div>
          <Link
            href={`/prenotato/${b.id}`}
            className="text-base font-semibold text-stone-900 hover:text-amber-700 transition-colors no-underline block truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </Link>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-semibold text-stone-900 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
            {Number(price)}<span className="text-sm text-stone-400">€</span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-stone-600 mb-3">
        <div>
          <dt className="text-stone-400 uppercase tracking-wide text-[9px] mb-0.5">Data</dt>
          <dd>{b.events?.date ? formatDate(b.events.date) : '—'}</dd>
        </div>
        <div>
          <dt className="text-stone-400 uppercase tracking-wide text-[9px] mb-0.5">Posteggio</dt>
          <dd className="font-mono">{b.stalls?.label || '—'}</dd>
        </div>
        <div>
          <dt className="text-stone-400 uppercase tracking-wide text-[9px] mb-0.5">Merce</dt>
          <dd>{b.goods_type || '—'}</dd>
        </div>
        {b.from_waitlist && (
          <div>
            <dt className="text-stone-400 uppercase tracking-wide text-[9px] mb-0.5">Origine</dt>
            <dd className="text-amber-700">Da lista d'attesa</dd>
          </div>
        )}
      </dl>

      {b.admin_cancel_reason && (
        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs">
          <div className="font-medium text-stone-700 mb-0.5">
            Annullata dall'organizzazione
            {b.admin_refunded ? ' · rimborso emesso' : ' · senza rimborso'}
          </div>
          <div className="text-stone-600">Motivo: <span className="italic">"{b.admin_cancel_reason}"</span></div>
        </div>
      )}

      {(cls.key === 'pending' || canRequestCancel) && (
        <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2 justify-end">
          {cls.key === 'pending' && (
            <CompleteBookingButton bookingId={b.id} isFree={Number(price) === 0} />
          )}
          {canRequestCancel && cls.key !== 'pending' && (
            <RequestBookingCancellation bookingId={b.id} />
          )}
        </div>
      )}
    </motion.div>
  )
}
