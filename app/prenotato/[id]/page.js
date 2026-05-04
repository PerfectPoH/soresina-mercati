import { createSupabaseServerClient } from '@/lib/supabase-server'
import { safeLogError } from '@/lib/log'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import CompleteBookingButton from '@/components/CompleteBookingButton'

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

  // BUG-018 (defense-in-depth): la RLS su `bookings` filtra gia'
  // (user_id = auth.uid() OR is_admin()), ma se in futuro venisse rilassata
  // o un bug di RLS la rendesse permissiva, qui verifichiamo esplicitamente
  // l'ownership in app code. Pattern "belt and suspenders".
  const { data: booking, error } = await supa
    .from('bookings')
    .select(`
      id, stall_id, event_id, user_id, status,
      vendor_name, vendor_phone, vendor_email, goods_type, notes, created_at,
      from_waitlist, waitlist_promoted_at,
      admin_cancel_reason, admin_refunded, admin_cancelled_at, paid_price,
      events ( id, title, date, location, description, price_per_stall, active ),
      stalls ( id, label, price, row_idx, col_idx )
    `)
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    safeLogError('[prenotato/:id] fetch error', error)
    return { notFound: true }
  }
  if (!booking) return { notFound: true }

  // Check ownership esplicito: solo il proprietario o un admin possono
  // vedere la pagina di conferma. Per un non-proprietario non-admin
  // ritorniamo notFound (non 403) per non confermare l'esistenza dell'ID.
  if (booking.user_id !== user.id) {
    const { data: vendor } = await supa
      .from('vendors')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!vendor || vendor.role !== 'admin') {
      return { notFound: true }
    }
  }

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

function formatDeadline(d) {
  if (!d) return ''
  return d.toLocaleString('it-IT', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
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
  // BUG-047: paid_price ha priorita' (snapshot immutabile). Fallback al
  // calcolo live per backward-compat con righe pre-migration 23.
  const price = booking.paid_price ?? stall?.price ?? ev?.price_per_stall
  const isCancelled = booking.status === 'cancelled'
  // Pending Stripe (15 min) o pending da waitlist (24h): UX distinta
  // dalla "Prenotazione confermata!" per evitare false promesse all'utente.
  const isPending   = booking.status === 'pending'
  const isFromWaitlist = !!booking.from_waitlist
  // Variant ui: cancelled / pending / confirmed
  const variant = isCancelled ? 'cancelled' : (isPending ? 'pending' : 'confirmed')

  // Breve codice di riferimento: ultime 8 char dell'uuid maiuscole
  const refCode = String(booking.id).replace(/-/g, '').slice(-8).toUpperCase()

  // Calcolo deadline pagamento per pending (informativa, non binding)
  const promotedAt = booking.waitlist_promoted_at ? new Date(booking.waitlist_promoted_at) : null
  const deadline   = promotedAt ? new Date(promotedAt.getTime() + 24 * 3600 * 1000) : null

  return (
    <div className="max-w-xl mx-auto">
      {/* Hero conferma */}
      <div className={`rounded-2xl p-6 sm:p-8 text-center border ${
        variant === 'cancelled' ? 'bg-stone-50 border-stone-200' :
        variant === 'pending'   ? 'bg-amber-50 border-amber-200'  :
                                  'bg-green-50 border-green-200'
      }`}>
        <div
          className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-3xl ${
            variant === 'cancelled' ? 'bg-stone-200 text-stone-500' :
            variant === 'pending'   ? 'bg-amber-200 text-amber-800' :
                                      'bg-green-500 text-white'
          }`}
          aria-hidden="true"
        >
          {variant === 'cancelled' ? '×' : variant === 'pending' ? '⏳' : '✓'}
        </div>
        <h1 className={`text-2xl font-medium mb-1 ${
          variant === 'cancelled' ? 'text-stone-700' :
          variant === 'pending'   ? 'text-amber-900' :
                                    'text-green-900'
        }`}>
          {variant === 'cancelled' ? 'Prenotazione annullata'
            : variant === 'pending' ? (isFromWaitlist ? 'In attesa di pagamento' : 'Pagamento in corso')
            : 'Prenotazione confermata!'}
        </h1>
        <p className={`text-sm ${
          variant === 'cancelled' ? 'text-stone-500' :
          variant === 'pending'   ? 'text-amber-800' :
                                    'text-green-700'
        }`}>
          {variant === 'cancelled'
            ? 'Questa prenotazione e\' stata annullata.'
            : variant === 'pending'
              ? (isFromWaitlist
                  ? `Il posto e\' tuo se completi il pagamento entro 24h${deadline ? ` (entro ${formatDeadline(deadline)})` : ''}. Trascorso questo tempo viene riassegnato al successivo in lista.`
                  : 'Stiamo aspettando la conferma del pagamento. Se non viene completato entro 15 minuti, il posto torna libero.'
                )
              : 'Il tuo posteggio e\' riservato. Salva il codice di prenotazione qui sotto.'}
        </p>
        <div className="mt-4 text-xs text-stone-400">
          Codice prenotazione: <span className="font-mono text-stone-600">{refCode}</span>
        </div>
      </div>

      {/* BUG-046: bottone "Completa il pagamento" / "Conferma" per i
          booking pending. Permette all'utente promosso da waitlist (o con
          checkout abbandonato) di completare la prenotazione senza dover
          rifare il flusso da zero. */}
      {variant === 'pending' && (
        <div className="mt-6 flex justify-center">
          <CompleteBookingButton
            bookingId={booking.id}
            isFree={Number(price) === 0}
          />
        </div>
      )}

      {/* BUG-045: motivo cancellazione admin (con/senza rimborso) */}
      {variant === 'cancelled' && booking.admin_cancel_reason && (
        <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
          <div className="text-sm font-medium text-stone-700 mb-1">
            Annullata dall'organizzazione
            {booking.admin_refunded ? ' · rimborso emesso' : ' · senza rimborso'}
          </div>
          <p className="text-sm text-stone-600 italic">"{booking.admin_cancel_reason}"</p>
        </div>
      )}

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
