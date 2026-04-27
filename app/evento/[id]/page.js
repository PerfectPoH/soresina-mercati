import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { safeLogError } from '@/lib/log'
import StallMapTabs from '@/components/StallMapTabs'
import WaitlistWidget from '@/components/WaitlistWidget'
import { notFound } from 'next/navigation'
import Link from 'next/link'

// La mappa dei posteggi cambia in tempo reale (prenotazioni).
// Forza il rendering dinamico e disabilita la cache fetch di Next.js,
// altrimenti la pagina mostra lo stato del primo caricamento.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getEvent(id) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

async function getStalls(eventId) {
  const { data, error } = await supabase
    .from('stalls_with_status')
    .select('*')
    .eq('event_id', eventId)
    .order('row_idx')
    .order('col_idx')
  if (error) return []
  return data
}

// Legge la sessione + profilo vendor lato server (cookie httpOnly).
// Questi valori vengono passati a StallMap/BookingForm come prop,
// cosi' il client non deve fare getSession da zero.
async function getCurrentVendor() {
  try {
    const supa = createSupabaseServerClient()
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return { user: null, vendor: null }

    const { data: vendor } = await supa
      .from('vendors')
      .select('name, phone, email, primary_goods_type, role')
      .eq('user_id', user.id)
      .maybeSingle()

    return {
      user: { id: user.id, email: user.email },
      vendor: vendor || null,
    }
  } catch (err) {
    safeLogError('[evento/:id] getCurrentVendor error', err)
    return { user: null, vendor: null }
  }
}

// Info lista d'attesa: iscrizione dell'utente + posizione + totale.
// Nota: la RLS limita la visibilita' delle righe, quindi il totale
// riflette solo cio' che il vendor puo' vedere (ci basta per sapere
// se e' iscritto). L'admin vede tutto dalla dashboard dedicata.
async function getWaitlistInfo(eventId, userId) {
  if (!userId) return { currentEntry: null, position: null, totalEntries: 0 }
  try {
    const supa = createSupabaseServerClient()
    const { data: entries } = await supa
      .from('waitlist')
      .select('id, user_id, created_at')
      .eq('event_id', eventId)
      .order('created_at')

    const all          = entries || []
    const currentEntry = all.find(e => e.user_id === userId) || null
    const position     = currentEntry
      ? all.findIndex(e => e.id === currentEntry.id) + 1
      : null
    return { currentEntry, position, totalEntries: all.length }
  } catch {
    return { currentEntry: null, position: null, totalEntries: 0 }
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function EventoPage({ params }) {
  const event  = await getEvent(params.id)
  if (!event) notFound()

  const [stalls, { user, vendor }] = await Promise.all([
    getStalls(event.id),
    getCurrentVendor(),
  ])

  const freeCount    = stalls.filter(s => s.stall_status === 'free').length
  const bookedCount  = stalls.filter(s => s.stall_status === 'booked').length
  const pendingCount = stalls.filter(s => s.stall_status === 'pending').length
  const blockedCount = stalls.filter(s => s.stall_status === 'blocked').length
  const isFull    = freeCount === 0 && stalls.length > 0
  const isAdmin   = vendor?.role === 'admin'

  // BUG-037: evento passato → niente prenotazione, niente waitlist.
  // Confronto YYYY-MM-DD: la data dell'evento e' un date PostgreSQL,
  // confrontiamo a livello calendario.
  const todayIso  = new Date().toISOString().slice(0, 10)
  const isPast    = event.date < todayIso

  // Carica info waitlist solo quando serve (evento pieno, non admin, non passato)
  const waitlist = (isFull && !isAdmin && !isPast)
    ? await getWaitlistInfo(event.id, user?.id)
    : null

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/" className="hover:text-stone-600 transition-colors">Mercati</Link>
        <span>/</span>
        <span className="text-stone-700">{event.title}</span>
      </div>

      {/* Hero evento. Due varianti:
          - Con immagine: hero grande (h-80 sm, 96 lg) con gradient overlay
            in basso e titolo sovrapposto. Fa il feel "rivista"/brochure.
          - Senza immagine: header classico con background crema, titolo serif.
          La chip data resta visibile in entrambi i casi. */}
      {event.image_url ? (
        <div className="mb-8 relative rounded-2xl overflow-hidden border border-stone-200 shadow-warm-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt=""
            loading="eager"
            decoding="async"
            className="w-full h-72 sm:h-80 lg:h-[26rem] object-cover"
          />
          {/* Gradient overlay + testo sovrapposto in basso.
              pointer-events-none in modo che un eventuale click "buchi"
              verso eventuali bottoni sotto l'hero (qui non ce ne sono,
              ma e' abitudine safe). */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, rgba(28,25,23,0.80) 0%, rgba(28,25,23,0.25) 45%, rgba(28,25,23,0) 65%)',
            }}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 text-white">
            <span
              className="inline-block text-[11px] uppercase tracking-[0.18em] font-medium px-2.5 py-1 rounded-full bg-white/95"
              style={{ color: '#5B3A08' }}
            >
              {formatDate(event.date)}
            </span>
            <h1 className="mt-3 font-display font-semibold text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight drop-shadow">
              {event.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
              <span>📍 {event.location}</span>
              <span>💶 {event.price_per_stall}€ / giornata</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-2xl border border-stone-200 bg-cream-50 p-6 sm:p-8 shadow-warm">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-8 bg-amber-brand" aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-amber-dark">
              {formatDate(event.date)}
            </span>
          </div>
          <h1 className="font-display font-semibold text-3xl sm:text-4xl text-amber-deep leading-[1.08] tracking-tight">
            {event.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
            <span>📍 {event.location}</span>
            <span>💶 {event.price_per_stall}€ / giornata</span>
          </div>
        </div>
      )}

      {/* Descrizione (se presente) */}
      {event.description && (
        <p className="mb-6 text-stone-600 text-base leading-relaxed max-w-2xl">
          {event.description}
        </p>
      )}

      {/* BUG-037: banner evento passato — niente prenotazione possibile */}
      {isPast && (
        <div className="mb-6 max-w-xl rounded-2xl border border-stone-200 bg-stone-50 p-5 text-stone-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl" aria-hidden="true">🔒</span>
            <h2 className="text-base font-medium text-stone-900">Mercato concluso</h2>
          </div>
          <p className="text-sm text-stone-600">
            Questo mercato si è già svolto. Le prenotazioni non sono più possibili. Resta in archivio per riferimento.
            <Link href="/" className="ml-1 text-amber-700 underline">Vedi i prossimi mercati</Link>.
          </p>
        </div>
      )}

      {/* Banner lista d'attesa (evento pieno, vendor non admin, non passato) */}
      {isFull && !isAdmin && !isPast && (
        <div className="mb-6 max-w-xl">
          <WaitlistWidget
            event={event}
            currentUser={user}
            currentVendor={vendor}
            currentEntry={waitlist?.currentEntry || null}
            position={waitlist?.position}
            totalEntries={waitlist?.totalEntries}
          />
        </div>
      )}

      {/* Pill row: riepilogo stato posteggi. Da' al visitatore il senso
          della disponibilita' prima ancora di guardare la mappa. Ogni
          stato usa la stessa coppia bg/fg che appare poi sulla griglia. */}
      {stalls.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-medium" aria-label="Stato posteggi">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sage-100 text-sage-700">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500" aria-hidden="true" />
            {freeCount} liberi
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 text-stone-600">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" aria-hidden="true" />
            {bookedCount} prenotati
          </span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-light text-amber-dark">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-mid" aria-hidden="true" />
              {pendingCount} in attesa
            </span>
          )}
          {blockedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" aria-hidden="true" />
              {blockedCount} bloccati
            </span>
          )}
        </div>
      )}

      {/* Mappa interattiva dei posteggi — tab Griglia + Satellite.
          Il tab Satellite mostra i posteggi posizionati dall'admin sulla
          vista aerea Esri World Imagery (senza API key ne' billing). */}
      <StallMapTabs
        stalls={stalls}
        event={event}
        currentUser={user}
        currentVendor={vendor}
        isPast={isPast}
      />
    </div>
  )
}
