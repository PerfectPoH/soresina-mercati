import { supabase } from '@/lib/supabase'
import { safeLogError } from '@/lib/log'
import Link from 'next/link'
import HomeEventCard from '@/components/HomeEventCard'

// La lista degli eventi cambia quando l'admin ne crea di nuovi o ne disattiva.
// Forza il rendering dinamico e disabilita la cache, altrimenti i visitatori
// continuano a vedere lo snapshot del primo caricamento.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getEvents() {
  // BUG-037: in homepage mostriamo SOLO eventi futuri (date >= oggi).
  // Gli eventi passati restano nel DB per storico ma non sono prenotabili
  // ne' visibili al pubblico. L'admin li vede archiviati nella dashboard.
  const todayIso = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('active', true)
    .gte('date', todayIso)
    .order('date', { ascending: true })

  if (error) {
    safeLogError('[home] events fetch error', error)
    return []
  }
  return data
}

// Conteggi stato posteggio per evento. Serve a mostrare sulla card "12 liberi"
// senza aprire l'evento. Una query sola sugli eventi attivi.
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

// Data breve "DOM 3 MAG" — chip overlay sulla card.
function formatChipDate(dateStr) {
  const d = new Date(dateStr)
  const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')
  const day     = d.toLocaleDateString('it-IT', { day: 'numeric' })
  const month   = d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
  return `${weekday} ${day} ${month}`.toUpperCase()
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

  // Pre-formattazione per i client component (no function across RSC boundary).
  const eventCards = events.map(event => {
    const c = counts.get(event.id)
    return {
      event,
      chipDate: formatChipDate(event.date),
      pill: statusPill(c),
      freeCount: c?.free ?? null,
      totalCount: c?.total ?? null,
    }
  })

  return (
    <div>
      {/*
        Hero filosofia Kenya Hara: tipografia come decoro, max whitespace,
        zero pattern decorativi, una sola accent color (amber-brand).
        Niente badge, niente CTA secondaria: la "voce" e' il titolo grosso
        Fraunces, l'unico bottone porta dove serve.
      */}
      <section className="pt-12 pb-20 sm:pt-20 sm:pb-28 text-center sm:text-left">
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400 mb-6">
          Pro Loco Soresina · Bancarelle online
        </p>
        <h1 className="font-display font-medium text-5xl sm:text-6xl lg:text-[4.5rem] text-stone-900 leading-[1.02] tracking-tight max-w-3xl">
          I mercati di{' '}
          <em className="italic font-medium text-amber-brand">Soresina</em>,
          {' '}prenotati in un minuto.
        </h1>
        <p className="mt-8 text-stone-500 text-lg sm:text-xl leading-relaxed max-w-xl mx-auto sm:mx-0">
          Scegli la data, scopri i posteggi disponibili sulla mappa,
          conferma online. Senza file e senza telefonate.
        </p>
        <div className="mt-10">
          <a
            href="#mercati"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-brand px-6 py-3 text-base font-medium text-white hover:bg-amber-dark transition-colors no-underline"
          >
            Vedi i prossimi mercati
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {/* Sezione eventi */}
      <section id="mercati" className="scroll-mt-20">
        <div className="mb-8 flex items-baseline justify-between border-b border-stone-200 pb-4">
          <h2 className="font-display font-medium text-2xl sm:text-[1.75rem] text-stone-900 tracking-tight">
            Prossimi mercati
          </h2>
          <span className="text-xs text-stone-400 uppercase tracking-wider">
            {events.length === 0 ? 'Nessun evento' : `${events.length} ${events.length === 1 ? 'evento' : 'eventi'}`}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400 shadow-warm">
            <p className="font-display text-xl text-stone-500 mb-2">In attesa.</p>
            <p className="text-sm">Nessun evento in programma al momento. Torna presto.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eventCards.map((card, i) => (
              <HomeEventCard
                key={card.event.id}
                event={card.event}
                chipDate={card.chipDate}
                pill={card.pill}
                freeCount={card.freeCount}
                totalCount={card.totalCount}
                index={i}
              />
            ))}
          </div>
        )}

        {/* Sezione "Sei un venditore?" — discreta, sotto la lista, no CTA hero */}
        <div className="mt-16 border-t border-stone-200 pt-10 text-center sm:text-left">
          <p className="text-stone-500 text-sm mb-2">
            Sei un venditore non ancora registrato?
          </p>
          <Link
            href="/registrati"
            className="inline-flex items-center gap-1 text-amber-dark text-sm font-medium hover:text-amber-brand transition-colors no-underline"
          >
            Crea un account venditore
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
