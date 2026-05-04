'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import EventCardImage from './EventCardImage'

// BUG-050 lezione: niente function come prop server->client. La card riceve
// solo dati gia' formattati come stringhe + numeri. La formattazione data e
// il pill di stato vengono calcolati nel server component (app/page.js).

/**
 * Card singola evento in homepage.
 * Filosofia: Stamen warm (data XL a sinistra come "topographic marker"),
 * Kenya Hara (whitespace generoso, tipografia come decoro),
 * micro-interazione hover lift -2px + stagger reveal Framer Motion.
 *
 * @param {{
 *   event: any,
 *   chipDate: string,
 *   pill: { label: string, cls: string },
 *   freeCount: number | null,
 *   totalCount: number | null,
 *   index?: number,
 * }} props
 */
export default function HomeEventCard({ event, chipDate, pill, freeCount, totalCount, index = 0 }) {
  // Progress bar posti liberi: solo se ci sono dati di occupancy.
  // Stamen-style: barra morbida con gradient warm, percentuale sotto.
  const hasOccupancy = totalCount && totalCount > 0
  const occupancy = hasOccupancy
    ? Math.round(((totalCount - freeCount) / totalCount) * 100)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
    >
      <Link
        href={`/evento/${event.id}`}
        className="group block bg-white rounded-2xl border border-stone-200 shadow-warm hover:shadow-warm-xl hover:border-amber-300 hover:-translate-y-0.5 transition-all duration-300 no-underline overflow-hidden"
        aria-label={event.title}
      >
        <div className="relative">
          <EventCardImage src={event.image_url} />
          {/* Date chip — overlay */}
          <span
            className="absolute top-2.5 left-2.5 text-[10px] font-semibold tracking-[0.05em] px-2 py-1 rounded-md bg-white/95 text-amber-dark shadow-sm"
            aria-hidden="true"
          >
            {chipDate}
          </span>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {/* Titolo evento — Fraunces */}
          <h3 className="font-display font-medium text-stone-900 text-xl leading-tight group-hover:text-amber-dark transition-colors">
            {event.title}
          </h3>

          {/* Descrizione/luogo */}
          <p className="text-stone-500 text-sm leading-relaxed line-clamp-2">
            {event.description || `${event.location} · ${event.price_per_stall}€/giornata`}
          </p>

          {/* Progress bar Stamen-style: posti occupati */}
          {hasOccupancy && (
            <div>
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-stone-600 font-medium">
                  {freeCount} {freeCount === 1 ? 'posto libero' : 'posti liberi'}
                </span>
                <span className="text-stone-400 tabular-nums">
                  {totalCount - freeCount}/{totalCount}
                </span>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500"
                  style={{ width: `${occupancy}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          )}

          {/* Footer: pill + CTA */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <span className={`text-[11px] font-medium px-2 py-1 rounded-md ${pill.cls}`}>
              {pill.label}
            </span>
            <span className="text-sm text-stone-400 group-hover:text-amber-brand group-hover:translate-x-0.5 transition-all flex items-center gap-1">
              Prenota
              <span aria-hidden="true">↗</span>
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
