import { supabase } from '@/lib/supabase'
import { safeLogError } from '@/lib/log'
import Link from 'next/link'
import EventCardImage from '@/components/EventCardImage'

// La lista degli eventi cambia quando l'admin ne crea di nuovi o ne disattiva.
// Forza il rendering dinamico e disabilita la cache, altrimenti i visitatori
// continuano a vedere lo snapshot del primo caricamento.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('active', true)
    .order('date', { ascending: true })

  if (error) {
    safeLogError('[home] events fetch error', error)
    return []
  }
  return data
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function HomePage() {
  const events = await getEvents()

  return (
    <div>
      {/* Hero "warm & sofisticato": eyebrow in amber, titolo serif Fraunces,
          sottotitolo in sans. Flourish decorativo sottile a sinistra.
          Il feel e' piu' "rivista di paese" che "dashboard SaaS". */}
      <div className="mb-10 relative">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-px w-8 bg-amber-brand" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-amber-dark">
            Pro Loco Soresina
          </span>
        </div>
        <h1 className="font-display font-medium text-4xl sm:text-5xl text-amber-deep leading-[1.08] tracking-tight mb-3">
          Prossimi mercati
        </h1>
        <p className="text-stone-600 text-base max-w-xl leading-relaxed">
          Prenota il tuo posteggio per i mercati e le sagre di Soresina,
          direttamente online. Scegli la data, scegli la posizione sulla mappa,
          conferma in un minuto.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-400 shadow-warm">
          Nessun evento in programma al momento.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <Link
              key={event.id}
              href={`/evento/${event.id}`}
              className="group bg-white rounded-2xl border border-stone-200 shadow-warm hover:shadow-warm-xl hover:border-amber-300 hover:-translate-y-0.5 transition-all duration-200 no-underline overflow-hidden flex flex-col"
            >
              {/* Hero image (opzionale). Se l'URL e' rotto o assente,
                  il componente mostra il placeholder gradient ambra col
                  disegno della bancarella. Client component: serve stato
                  per il fallback onError (i server components non possono
                  passare funzioni come prop). */}
              <EventCardImage src={event.image_url} />

              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full tracking-wide"
                    style={{ background: '#FAEEDA', color: '#BA7517' }}
                  >
                    {formatDate(event.date).split(' ').slice(1).join(' ')}
                  </span>
                  <span
                    className="text-stone-300 group-hover:text-amber-brand group-hover:translate-x-1 transition-all text-lg"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </div>
                <h2 className="font-display font-medium text-stone-900 text-xl mb-1.5 leading-tight group-hover:text-amber-dark transition-colors">
                  {event.title}
                </h2>
                {event.description && (
                  <p className="text-stone-500 text-sm mb-3 leading-relaxed line-clamp-2">{event.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-stone-400 mt-auto pt-3 border-t border-stone-100">
                  <span className="truncate">📍 {event.location}</span>
                  <span className="ml-auto font-medium text-stone-600 whitespace-nowrap">
                    {event.rows * event.cols} posteggi · {event.price_per_stall}€/g
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
