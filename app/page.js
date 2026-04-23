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
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-stone-900 mb-1">
          Prossimi mercati
        </h1>
        <p className="text-stone-500 text-sm">
          Prenota il tuo posteggio per i mercati di Soresina
        </p>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center text-stone-400">
          Nessun evento in programma al momento.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <Link
              key={event.id}
              href={`/evento/${event.id}`}
              className="group bg-white rounded-xl border border-stone-200 hover:border-amber-400 hover:shadow-warm-lg transition-all no-underline overflow-hidden flex flex-col"
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
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: '#FAEEDA', color: '#BA7517' }}
                  >
                    {formatDate(event.date).split(' ').slice(1).join(' ')}
                  </span>
                  <span className="text-stone-300 group-hover:text-amber-500 transition-colors text-sm">→</span>
                </div>
                <h2 className="font-medium text-stone-900 text-base mb-1 group-hover:text-amber-800 transition-colors">
                  {event.title}
                </h2>
                {event.description && (
                  <p className="text-stone-400 text-sm mb-3 leading-relaxed">{event.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-stone-400 mt-auto pt-3 border-t border-stone-100">
                  <span>📍 {event.location}</span>
                  <span className="ml-auto font-medium text-stone-600">
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
