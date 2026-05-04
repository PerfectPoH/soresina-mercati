import { createSupabaseServerClient } from '@/lib/supabase-server'
import { safeLogError } from '@/lib/log'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import CompleteBookingButton from '@/components/CompleteBookingButton'

// Pagina di conferma post-prenotazione.
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
  // verifichiamo esplicitamente l'ownership in app code.
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

  // Check ownership esplicito.
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

  if (res.unauth) {
    redirect(`/accedi?next=${encodeURIComponent(`/prenotato/${params.id}`)}`)
  }
  if (res.notFound) notFound()

  const { booking } = res
  const ev    = booking.events
  const stall = booking.stalls
  // BUG-047: paid_price ha priorita' (snapshot immutabile).
  const price = booking.paid_price ?? stall?.price ?? ev?.price_per_stall
  const isCancelled = booking.status === 'cancelled'
  const isPending   = booking.status === 'pending'
  const isFromWaitlist = !!booking.from_waitlist
  const variant = isCancelled ? 'cancelled' : (isPending ? 'pending' : 'confirmed')

  // Breve codice di riferimento: ultime 8 char dell'uuid maiuscole
  const refCode = String(booking.id).replace(/-/g, '').slice(-8).toUpperCase()

  // Calcolo deadline pagamento per pending (informativa, non binding)
  const promotedAt = booking.waitlist_promoted_at ? new Date(booking.waitlist_promoted_at) : null
  const deadline   = promotedAt ? new Date(promotedAt.getTime() + 24 * 3600 * 1000) : null

  const heroTitle =
    variant === 'cancelled' ? 'Prenotazione annullata.'
    : variant === 'pending'  ? (isFromWaitlist ? 'In attesa di pagamento.' : 'Pagamento in corso.')
    : 'Prenotazione confermata.'

  const heroSubtitle =
    variant === 'cancelled'
      ? 'Questa prenotazione e\' stata annullata.'
      : variant === 'pending'
        ? (isFromWaitlist
            ? `Il posto e\' tuo se completi il pagamento entro 24h${deadline ? ` (entro ${formatDeadline(deadline)})` : ''}. Trascorso questo tempo viene riassegnato al successivo in lista.`
            : 'Stiamo aspettando la conferma del pagamento. Se non viene completato entro 15 minuti, il posto torna libero.'
          )
        : 'Il tuo posteggio e\' riservato. Salva il codice di prenotazione qui sotto.'

  return (
    <div className="max-w-xl mx-auto">
      {/*
        Hero variant — filosofia Sagmeister: tipografia grande come "momento",
        piccolo accent visivo (cerchio colorato) invece di icone emoji,
        breath verticale generoso.
      */}
      <div className={`rounded-2xl p-8 sm:p-10 text-center border ${
        variant === 'cancelled' ? 'bg-stone-50 border-stone-200' :
        variant === 'pending'   ? 'bg-amber-50 border-amber-200'  :
                                  'bg-green-50/60 border-green-200'
      }`}>
        {/* Indicator dot ring — accent senza emoji */}
        <div className="flex justify-center mb-6" aria-hidden="true">
          <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${
            variant === 'cancelled' ? 'bg-stone-200/60' :
            variant === 'pending'   ? 'bg-amber-200/60' :
                                      'bg-green-200/50'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              variant === 'cancelled' ? 'bg-stone-400 text-white' :
              variant === 'pending'   ? 'bg-amber-500 text-white' :
                                        'bg-green-600 text-white'
            }`}>
              {variant === 'cancelled'
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>
                : variant === 'pending'
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>}
            </div>
          </div>
        </div>

        <h1
          className={`text-3xl sm:text-4xl tracking-tight leading-tight mb-3 ${
            variant === 'cancelled' ? 'text-stone-700' :
            variant === 'pending'   ? 'text-amber-900' :
                                      'text-green-900'
          }`}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          {heroTitle}
        </h1>
        <p className={`text-sm sm:text-base max-w-md mx-auto leading-relaxed ${
          variant === 'cancelled' ? 'text-stone-500' :
          variant === 'pending'   ? 'text-amber-800' :
                                    'text-green-800/90'
        }`}>
          {heroSubtitle}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-stone-400">
          Codice
          <span className="font-mono text-stone-700 tracking-wider">{refCode}</span>
        </div>
      </div>

      {/* BUG-046: bottone "Completa il pagamento" / "Conferma" per pending */}
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
            Annullata dall&apos;organizzazione
            {booking.admin_refunded ? ' · rimborso emesso' : ' · senza rimborso'}
          </div>
          <p className="text-sm text-stone-600 italic">&ldquo;{booking.admin_cancel_reason}&rdquo;</p>
        </div>
      )}

      {/* Riepilogo dettagli */}
      <div className="mt-8 bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-baseline justify-between">
          <h2 className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">Riepilogo</h2>
          <span className="text-xs text-stone-400 tabular-nums">
            {price}€
          </span>
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
            value={<span className="font-medium text-amber-700 tabular-nums">{price}€</span>}
          />
        </dl>
      </div>

      {/* Dati intestatario */}
      <div className="mt-4 bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">Intestatario</h2>
        </div>
        <dl className="divide-y divide-stone-100">
          <Row label="Nome"      value={booking.vendor_name} />
          {booking.vendor_phone && <Row label="Telefono" value={booking.vendor_phone} />}
          {booking.vendor_email && <Row label="Email"    value={booking.vendor_email} />}
        </dl>
      </div>

      {/* Azioni — icone SVG inline invece di emoji */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!isCancelled && ev?.id && (
          <a
            href={`/api/bookings/${booking.id}/ics`}
            className="text-center text-sm rounded-xl py-3 px-4 text-white font-medium no-underline flex items-center justify-center gap-2"
            style={{ background: '#BA7517' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            Aggiungi al calendario
          </a>
        )}
        {ev?.id && (
          <a
            href={`/evento/${ev.id}`}
            className="text-center text-sm rounded-xl py-3 px-4 border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/>
              <path d="M9 3v15M15 6v15"/>
            </svg>
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
        <div className="mt-6 text-xs text-stone-600 bg-amber-50/80 border border-amber-200/80 rounded-xl px-4 py-3">
          <p className="font-medium text-amber-900 mb-1.5 uppercase tracking-wider text-[10px]">Cosa fare ora</p>
          <ul className="list-disc list-inside space-y-1 leading-relaxed">
            <li>Salva questa pagina o il codice prenotazione <span className="font-mono text-stone-800">{refCode}</span>.</li>
            <li>Arriva in piazza almeno 30 minuti prima dell&apos;inizio del mercato.</li>
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
      <dt className="text-[10px] text-stone-400 shrink-0 pt-0.5 uppercase tracking-wider font-medium">{label}</dt>
      <dd className="text-sm text-stone-800 text-right flex-1">{value || '—'}</dd>
    </div>
  )
}
