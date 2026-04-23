import { createSupabaseServerClient } from '@/lib/supabase-server'
import { safeLogError } from '@/lib/log'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

// Pagina di conferma post-prenotazione.
// Flusso:
//   BookingForm POST /api/book -> riceve data.booking -> router.push('/prenotato/<id>')
//   -> questa pagina.
//
// Server component: legge la prenotazione con i cookie httpOnly, verifica
// che appartenga all'utente (o che sia admin), e mostra riepilogo +
// azioni (vedi mappa, aggiungi al calendario, stampa). In questo modo
// l'URL di conferma e' bookmarkable/condivisibile dall'utente.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Prenotazione confermata',
  // Noindex: la conferma e' personale, non va in SERP
  robots: { index: false, follow: false },
}

async function getBookingWithContext(bookingId) {
  const supa = createSupabaseServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return { unauth: true }

  // RLS consente: proprietario (user_id = auth.uid()) oppure admin.
  // Usiamo una select con join logico sugli eventi/stalls per avere
  // tutto in una query.
  const { data: booking, error } = await supa
    .from('bookings')
    .select(`
      id, stall_id, event_id, user_id, status,
      vendor_name, vendor_phone, vendor_email, goods_type, notes, created_at,
      events ( id, title, date, location, description, price_per_stall ),
      stalls ( id, label, price, row_idx, col_idx )
    `)
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    safeLogError('[prenotato/:id] fetch error', error)
    return { notFound: true }
  }
  if (!booking) return { notFound: true }

  return { booking, user }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PrenotatoPage({ params }) {
  const res = await getBookingWithContext(params.id)

  // Non loggato: mandalo ad /accedi con redirect di ritorno qui
  if (res.unauth) {
    redirect(`/accedi?next=${encodeURIComponent(`/prenotato/${params.id}`)}`)
  }
  if (res.notFound) notFound()

  const { booking } = res
  const ev    = booking.events
  const stall = booking.stalls
  const price = stall?.price ?? ev?.price_per_stall
  const isCancelled = booking.status === 'cancelled'

  // Breve codice di riferimento: ultime 8 char dell'uuid maiuscole
  const refCode = String(booking.id).replace(/-/g, '').slice(-8).toUpperCase()

  return (
    <div className="max-w-xl mx-auto">
      {/* Hero conferma */}
      <div className={`rounded-2xl p-6 sm:p-8 text-center border ${
        isCancelled
          ? 'bg-stone-50 border-stone-200'
          : 'bg-green-50 border-green-200'
      }`}>
        <div
          className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-3xl ${
            isCancelled
              ? 'bg-stone-200 text-stone-500'
              : 'bg-green-500 text-white'
          }`}
          aria-hidden="true"
        >
          {isCancelled ? '×' : '✓'}
        </div>
        <h1 className={`text-2xl font-medium mb-1 ${isCancelled ? 'text-stone-700' : 'text-green-900'}`}>
          {isCancelled ? 'Prenotazione annullata' : 'Prenotazione confermata!'}
        </h1>
        <p className={`text-sm ${isCancelled ? 'text-stone-500' : 'text-green-700'}`}>
          {isCancelled
            ? 'Questa prenotazione e\' stata annullata.'
            : 'Il tuo posteggio e\' riservato. Riceverai anche una conferma via email.'}
        </p>
        <div className="mt-4 text-xs text-stone-400">
          Codice prenotazione: <span className="font-mono text-stone-600">{refCode}</span>
        </div>
      </div>

      {/* Riepilogo dettagli */}
      <div className="mt-6 bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">Riepilogo</h2>
        </div>
        <dl className="divide-y divide-stone-100">
          <Row label="Evento" value={ev?.title} />
          <Row label="Data"   value={formatDate(ev?.date)} />
          {ev?.location && <Row label="Luogo"  value={ev.location} />}
          <Row
            label="Posteggio"
            value={stall ? `${stall.label}${stall.row_idx !== undefined ? ` (Fila ${String.fromCharCode(65 + stall.row_idx)})` : ''}` : '—'}
          />
          <Row label="Tipo di merce" value={booking.goods_type} />
          {booking.notes && <Row label="Note" value={booking.notes} />}
          <Row
            label="Costo"
            value={<span className="font-medium text-amber-700">{price}€</span>}
          />
        </dl>
      </div>

      {/* Dati intestatario */}
      <div className="mt-4 bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">Intestatario</h2>
        </div>
        <dl className="divide-y divide-stone-100">
          <Row label="Nome"      value={booking.vendor_name} />
          {booking.vendor_phone && <Row label="Telefono" value={booking.vendor_phone} />}
          {booking.vendor_email && <Row label="Email"    value={booking.vendor_email} />}
        </dl>
      </div>

      {/* Azioni */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!isCancelled && ev?.id && (
          <a
            href={`/api/bookings/${booking.id}/ics`}
            className="text-center text-sm rounded-xl py-3 px-4 text-white font-medium no-underline flex items-center justify-center gap-2"
            style={{ background: '#BA7517' }}
          >
            <span aria-hidden="true">📅</span>
            Aggiungi al calendario
          </a>
        )}
        {ev?.id && (
          // <a> normale (non <Link>) per forzare un full-page reload.
          // Next.js App Router tiene in cache client-side le pagine gia'
          // visitate: con <Link> l'utente vedrebbe la mappa "congelata"
          // al primo caricamento (il posteggio appena prenotato sembra
          // ancora libero) finche' non arriva un evento Realtime o un
          // refresh manuale. Un anchor <a> hard-naviga e rifetcha tutto.
          <a
            href={`/evento/${ev.id}`}
            className="text-center text-sm rounded-xl py-3 px-4 border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline flex items-center justify-center gap-2"
          >
            <span aria-hidden="true">🗺</span>
            Torna alla mappa
          </a>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-stone-400">
        <Link href="/profilo" className="hover:text-stone-600 transition-colors no-underline">
          Le mie prenotazioni
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/" className="hover:text-stone-600 transition-colors no-underline">
          Home
        </Link>
      </div>

      {/* Istruzioni pratiche */}
      {!isCancelled && (
        <div className="mt-6 text-xs text-stone-500 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="font-medium text-amber-900 mb-1">Cosa fare ora</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Salva questa pagina o il codice prenotazione <span className="font-mono">{refCode}</span>.</li>
            <li>Arriva in piazza almeno 30 minuti prima dell'inizio del mercato.</li>
            <li>Per annullare o modificare la prenotazione, contatta la Pro Loco Soresina.</li>
          </ul>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="px-5 py-3 flex items-start justify-between gap-4">
      <dt className="text-xs text-stone-500 shrink-0 pt-0.5 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-stone-800 text-right flex-1">{value || '—'}</dd>
    </div>
  )
}
