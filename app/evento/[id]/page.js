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

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  const day   = d.toLocaleDateString('it-IT', { day: 'numeric' })
  const month = d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
  return { day, month: month.toUpperCase() }
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

  const todayIso  = new Date().toISOString().slice(0, 10)
  const isPast    = event.date < todayIso

  const waitlist = (isFull && !isAdmin && !isPast)
    ? await getWaitlistInfo(event.id, user?.id)
    : null

  const { day, month } = formatShortDate(event.date)
  const occupancy = stalls.length > 0
    ? Math.round((bookedCount / stalls.length) * 100)
    : 0

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-stone-400 mb-6">
        <Link href="/" className="hover:text-stone-600 transition-colors no-underline">Mercati</Link>
        <span aria-hidden="true">/</span>
        <span className="text-stone-700 truncate">{event.title}</span>
      </div>

      {/*
        Hero filosofia Müller-Brockmann: griglia disciplinata, dati come decoro.
        Layout split: data XL a sinistra (Fraunces), titolo + meta a destra.
        Niente immagine sopra, niente badge: la mappa sotto e' l'eroe.
        Se c'e' image_url la mostriamo dopo la sezione info come "evidence".
      */}
      <header className="mb-10 grid grid-cols-12 gap-6 items-start border-b border-stone-200 pb-8">
        <div className="col-span-12 sm:col-span-3 lg:col-span-2">
          <div className="font-display tracking-tight">
            <div className="text-6xl sm:text-7xl text-amber-brand leading-none tabular-nums">{day}</div>
            <div className="text-sm text-stone-500 uppercase tracking-[0.2em] mt-1">{month}</div>
          </div>
        </div>
        <div className="col-span-12 sm:col-span-9 lg:col-span-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400 mb-2">
            {formatDate(event.date)}
          </p>
          <h1 className="font-display font-medium text-3xl sm:text-4xl lg:text-5xl text-stone-900 leading-[1.05] tracking-tight">
            {event.title}
          </h1>
          {event.description && (
            <p className="mt-4 text-stone-600 text-base sm:text-lg leading-relaxed max-w-2xl">
              {event.description}
            </p>
          )}
        </div>
      </header>

      {/* Image (se presente) — sotto l'header come "evidence" non come hero */}
      {event.image_url && (
        <div className="mb-8 rounded-2xl overflow-hidden border border-stone-200 shadow-warm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt=""
            loading="eager"
            decoding="async"
            className="w-full h-56 sm:h-72 object-cover"
          />
        </div>
      )}

      {/* Info grid 2x2: data, luogo, prezzo, posti — griglia disciplinata Müller-Brockmann */}
      <dl className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200 border border-stone-200 rounded-2xl overflow-hidden">
        <InfoCell label="Data" value={formatDate(event.date)} />
        <InfoCell label="Luogo" value={event.location || '—'} />
        <InfoCell label="Prezzo" value={`${event.price_per_stall}€ / giorno`} />
        <InfoCell
          label="Posti"
          value={stalls.length > 0
            ? `${freeCount} liberi · ${stalls.length} totali`
            : 'In preparazione'}
        />
      </dl>

      {/* BUG-037: banner evento passato */}
      {isPast && (
        <div className="mb-6 max-w-xl rounded-2xl border border-stone-200 bg-stone-50 p-5 text-stone-700">
          <h2 className="text-base font-medium text-stone-900 mb-1">Mercato concluso</h2>
          <p className="text-sm text-stone-600">
            Questo mercato si è già svolto. Le prenotazioni non sono più possibili.
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

      {/* Occupancy bar + pill stato — riepilogo sintetico prima della mappa */}
      {stalls.length > 0 && !isPast && (
        <div className="mb-6">
          <div className="flex items-baseline justify-between text-xs mb-2">
            <span className="text-stone-500 uppercase tracking-wider">Disponibilità</span>
            <span className="text-stone-900 font-medium tabular-nums">
              {freeCount} su {stalls.length}
            </span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500"
              style={{ width: `${occupancy}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium" aria-label="Stato posteggi">
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
        </div>
      )}

      {/* Mappa interattiva dei posteggi — l'eroe della pagina */}
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

function InfoCell({ label, value }) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <dt className="text-[10px] uppercase tracking-wider text-stone-400 font-medium mb-1.5">{label}</dt>
      <dd className="text-sm sm:text-base text-stone-900 font-medium leading-snug">{value}</dd>
    </div>
  )
}
