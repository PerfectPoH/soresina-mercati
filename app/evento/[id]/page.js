import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { safeLogError } from '@/lib/log'
import StallMap from '@/components/StallMap'
import WaitlistWidget from '@/components/WaitlistWidget'
import EventMap from '@/components/EventMap'
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

  const freeCount = stalls.filter(s => s.stall_status === 'free').length
  const isFull    = freeCount === 0 && stalls.length > 0
  const isAdmin   = vendor?.role === 'admin'

  // Carica info waitlist solo quando serve (evento pieno, non admin)
  const waitlist = (isFull && !isAdmin)
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

      {/* Hero image (se presente). Si nasconde in caso di errore di caricamento
          cosi' un URL rotto non lascia un riquadro vuoto. */}
      {event.image_url && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-stone-200 bg-cream-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt={event.title}
            loading="eager"
            decoding="async"
            className="w-full max-h-72 object-cover"
          />
        </div>
      )}

      {/* Header evento */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900 mb-1 tracking-tight">{event.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-stone-500">
          <span>📅 {formatDate(event.date)}</span>
          <span>📍 {event.location}</span>
          <span>💶 {event.price_per_stall}€ / giornata</span>
        </div>
        {event.description && (
          <p className="mt-2 text-stone-500 text-sm leading-relaxed">{event.description}</p>
        )}
      </div>

      {/* Banner lista d'attesa (evento pieno, vendor non admin) */}
      {isFull && !isAdmin && (
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

      {/* Mappa interattiva dei posteggi */}
      <StallMap stalls={stalls} event={event} currentUser={user} currentVendor={vendor} />

      {/* Mappa geografica (Google Maps embed) del luogo dell'evento.
          Aiuta i venditori a capire dove parcheggiare il furgone. */}
      <EventMap location={event.location} title={event.title} />
    </div>
  )
}
