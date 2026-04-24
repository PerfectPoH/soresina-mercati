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

// Conteggi stato posteggio per evento. Serve a mostrare sulla card
// "12 liberi" / "Esaurito" senza costringere il visitatore ad aprire
// l'evento per scoprirlo. Una query sola sugli eventi attivi.
async function getStallCounts(eventIds) {
  if (!eventIds.length) return new Map()
  const { data, error } = await supabase
    .from('stalls_with_status')
    .select('event_id, stall_status')
    .in('event_id', eventIds)
  if (error) {
    safeLogError('[home] stall counts fetch error', error)
    return new Map()
  }
  const counts = new Map()
  for (const row of data || []) {
    const c = counts.get(row.event_id) || { free: 0, booked: 0, pending: 0, blocked: 0, total: 0 }
    c[row.stall_status] = (c[row.stall_status] || 0) + 1
    c.total += 1
    counts.set(row.event_id, c)
  }
  return counts
}

// Data breve: "DOM 3 MAG" — chip sulla card. Full date per lo screen reader.
function formatChipDate(dateStr) {
  const d = new Date(dateStr)
  const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')
  const day     = d.toLocaleDateString('it-IT', { day: 'numeric' })
  const month   = d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
  return `${weekday} ${day} ${month}`.toUpperCase()
}

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Pill stato posteggi: verde se tanti liberi, ambra se pochi, grigio se zero.
function statusPill(counts) {
  if (!counts || counts.total === 0) {
    return { label: 'In preparazione', cls: 'bg-stone-100 text-stone-500' }
  }
  if (counts.free === 0) {
    return { label: 'Esaurito', cls: 'bg-stone-100 text-stone-600' }
  }
  if (counts.free <= 5) {
    return { label: `${counts.free} liberi`, cls: 'bg-amber-light text-amber-dark' }
  }
  return { label: `${counts.free} liberi`, cls: 'bg-sage-100 text-sage-700' }
}

export default async function HomePage() {
  const events = await getEvents()
  const counts = await getStallCounts(events.map(e => e.id))

  return (
    <div>
      {/* Hero editoriale "warm & sofisticato".
          - Pill badge con pallino ambra (prenotazioni aperte)
          - H1 serif con "Soresina" in corsivo ambra = il "momento
            editoriale" della pagina, fa riconoscere subito il marchio.
          - Due CTA: ambra piena (scroll agli eventi) + outline (area venditori). */}
      <section className="mb-12 sm:mb-14 text-center sm:text-left">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-light px-3 py-1 text-[11px] font-medium text-amber-dark tracking-[0.04em]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-brand" aria-hidden="true" />
          Prenotazioni aperte · {new Date().getFullYear()}
        </span>
        <h1 className="mt-4 font-display font-medium text-4xl sm:text-5xl lg:text-[3.25rem] text-amber-deep leading-[1.06] tracking-tight">
          I mercati di{' '}
          <em className="italic font-medium text-amber-brand">Soresina</em>,
          <br className="hidden sm:block" /> prenotati in un minuto.
        </h1>
        <p className="mt-4 text-stone-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto sm:mx-0">
          Scopri le date, scegli il tuo posteggio sulla mappa e conferma
          online. Senza file, senza telefonate.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center sm:justify-start gap-3">
          <a
            href="#mercati"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-dark transition-colors no-underline"
          >
            Vedi i prossimi mercati
            <span aria-hidden="true">↗</span>
          </a>
          <Link
            href="/registrati"
            className="inline-flex items-center rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 hover:border-amber-brand hover:text-amber-dark transition-colors no-underline"
          >
            Sei un venditore?
          </Link>
        </div>
      </section>

      {/* Sezione eventi */}
      <section id="mercati" className="scroll-mt-20">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-display font-medium text-2xl sm:text-[1.75rem] text-stone-900">
            Prossimi mercati
          </h2>
          <span className="text-xs text-stone-400">
            {events.length === 0 ? 'Nessun evento' : `${events.length} ${events.length === 1 ? 'evento' : 'eventi'} in programma`}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-400 shadow-warm">
            Nessun evento in programma al momento.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map(event => {
              const c    = counts.get(event.id)
              const pill = statusPill(c)
              return (
                <Link
                  key={event.id}
                  href={`/evento/${event.id}`}
                  className="group bg-white rounded-2xl border border-stone-200 shadow-warm hover:shadow-warm-xl hover:border-amber-300 hover:-translate-y-0.5 transition-all duration-200 no-underline overflow-hidden flex flex-col"
                  aria-label={`${event.title} — ${formatFullDate(event.date)}`}
                >
                  {/* Hero visuale della card: immagine se presente,
                      altrimenti fascia gradient col marker. Il date chip
                      in alto a sinistra e' sempre visibile sopra la fascia. */}
                  <div className="relative">
                    <EventCardImage src={event.image_url} />
                    <span
                      className="absolute top-2.5 left-2.5 text-[10px] font-semibold tracking-[0.05em] px-2 py-1 rounded-md bg-white/95 text-amber-dark shadow-sm"
                      aria-hidden="true"
                    >
                      {formatChipDate(event.date)}
                    </span>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-display font-medium text-stone-900 text-xl mb-1.5 leading-tight group-hover:text-amber-dark transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-stone-500 text-sm leading-relaxed mb-4 line-clamp-2 flex-1">
                      {event.description || `${event.location} · ${event.price_per_stall}€/giornata`}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-stone-100">
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
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
