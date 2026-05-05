import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { safeLogError } from '@/lib/log'
import { sendEmail } from '@/lib/email'
import { bookingConfirmedEmail } from '@/lib/email-templates'

// Stripe SDK requires Node runtime (uses crypto/Buffer non disponibili in Edge).
export const runtime = 'nodejs'

// BUG-014: agent debug instrumentation. No-op per default. Si attiva solo
// in dev locale con AGENT_DEBUG_INGEST_URL settato.
function debugLog(hypothesisId, location, message, data = {}, runId = 'run1') {
  if (process.env.NODE_ENV === 'production') return
  const url = process.env.AGENT_DEBUG_INGEST_URL
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': process.env.AGENT_DEBUG_SESSION_ID || 'local' },
    body: JSON.stringify({
      sessionId: process.env.AGENT_DEBUG_SESSION_ID || 'local',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
}

// Stripe va inizializzato lazily: se la SECRET_KEY manca al build (es. preview
// senza env Stripe configurate) il modulo non deve esplodere all'import.
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null

export async function POST(req) {
  debugLog('H1', 'app/api/webhooks/stripe/route.js:POST:entry', 'webhook entry', {
    hasStripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    hasSignatureHeader: Boolean(req.headers.get('stripe-signature')),
  })
  if (!stripe) {
    safeLogError('[stripe webhook] Stripe non configurato (STRIPE_SECRET_KEY mancante)')
    debugLog('H1', 'app/api/webhooks/stripe/route.js:POST:missing_stripe_secret', 'missing stripe secret')
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 })
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    safeLogError('[stripe webhook] STRIPE_WEBHOOK_SECRET non configurato')
    debugLog('H1', 'app/api/webhooks/stripe/route.js:POST:missing_webhook_secret', 'missing webhook secret')
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 })
  }

  // 1. Verifica signature.
  // req.text() restituisce il body raw, necessario per il check HMAC.
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature')
  let event
  try {
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    safeLogError('[stripe webhook] signature verification failed', err)
    debugLog('H2', 'app/api/webhooks/stripe/route.js:POST:signature_failed', 'signature verification failed')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  debugLog('H2', 'app/api/webhooks/stripe/route.js:POST:event_parsed', 'stripe event parsed', {
    eventId: event?.id || null,
    eventType: event?.type || null,
  })

  const supabase = createSupabaseAdminClient()

  // 2. Idempotency: registra l'event id PRIMA di processarlo.
  // Ordine importante. Se inseriamo dopo l'update, e Stripe rinvia il webhook
  // dopo che l'update e' andato a buon fine ma prima che noi salviamo l'id,
  // il secondo retry rifara' il lavoro. Per checkout.session.completed e'
  // tollerabile (idempotente), per .expired NO: rischiamo di sovrascrivere
  // un booking gia' confirmed con cancelled.
  // Usiamo INSERT ... ON CONFLICT DO NOTHING come "lock" atomico: se la
  // INSERT non aggiunge righe (count=0 / conflict), vuol dire che un altro
  // worker sta processando lo stesso evento. Skippiamo.
  const { data: insertedSeen, error: insertSeenErr } = await supabase
    .from('stripe_events_seen')
    .insert({ id: event.id, type: event.type })
    .select('id')
    .maybeSingle()

  debugLog('H3', 'app/api/webhooks/stripe/route.js:POST:idempotency_insert_result', 'idempotency insert result', {
    eventId: event.id,
    hasInsertError: Boolean(insertSeenErr),
    insertErrorCode: insertSeenErr?.code || null,
    inserted: Boolean(insertedSeen),
  })

  if (insertSeenErr) {
    // 23505 = unique violation = evento gia' processato (caso comune in retry)
    if (insertSeenErr.code === '23505') {
      return NextResponse.json({ received: true, deduped: true })
    }
    safeLogError('[stripe webhook] error registering event in stripe_events_seen', insertSeenErr)
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }
  if (!insertedSeen) {
    // Race con altro worker, non riprocessiamo
    return NextResponse.json({ received: true, deduped: true })
  }

  // 3. Process event types
  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(supabase, event.data.object)
    } else if (event.type === 'checkout.session.expired') {
      await handleCheckoutExpired(supabase, event.data.object)
    } else if (event.type === 'checkout.session.async_payment_succeeded') {
      // payment methods asincroni (es. SEPA) confermano qui, non in completed
      await handleCheckoutCompleted(supabase, event.data.object)
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await handleCheckoutExpired(supabase, event.data.object)
    }
  } catch (err) {
    safeLogError(`[stripe webhook] error handling ${event.type}`, err)
    debugLog('H4', 'app/api/webhooks/stripe/route.js:POST:handler_failed', 'webhook handler failed', {
      eventId: event.id,
      eventType: event.type,
      errorCode: err?.code || null,
      errorName: err?.name || null,
    })
    // Rimuoviamo il marker idempotency cosi' Stripe puo' rinviare e ritentare
    await supabase.from('stripe_events_seen').delete().eq('id', event.id)
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 })
  }

  debugLog('H4', 'app/api/webhooks/stripe/route.js:POST:success', 'webhook processed', {
    eventId: event.id,
    eventType: event.type,
  })
  return NextResponse.json({ received: true })
}

// --- Handlers ---

async function handleCheckoutCompleted(supabase, session) {
  const bookingId = session.metadata?.booking_id
  if (!bookingId) return

  // Salviamo session_id + payment_intent: serviranno per il rimborso
  // quando l'admin approva una richiesta di cancellazione.
  // Confermiamo solo se la booking e' ancora pending. Evita che un
  // checkout.session.completed che arriva DOPO un expired sovrascriva
  // 'cancelled' con 'confirmed' per un pagamento mai realmente avvenuto.
  const paymentIntent = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null

  // BUG-040 (Resend): selezioniamo il booking gia' aggiornato per avere
  // tutti i dati necessari all'email di conferma in un solo round-trip.
  const { data: confirmed, error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      stripe_session_id:        session.id || null,
      stripe_payment_intent_id: paymentIntent,
    })
    .eq('id', bookingId)
    .eq('status', 'pending')
    .select(`
      id, vendor_name, vendor_email, paid_price,
      events ( title, date, location ),
      stalls ( label )
    `)
    .maybeSingle()

  if (error) throw error
  // Se non c'e' confirmed, vuol dire che il booking non era pending (gia'
  // confermato da un precedente webhook). Non rinviamo l'email per non
  // duplicare. Questo e' coerente con la deduplica su stripe_events_seen.
  if (!confirmed) return

  // Email di conferma. Fail-safe: se l'invio fallisce non rolliamo back
  // la conferma, l'utente vede comunque /prenotato/[id] sul sito.
  if (confirmed.vendor_email && confirmed.events) {
    const tpl = bookingConfirmedEmail({
      to:            confirmed.vendor_email,
      bookingId:     confirmed.id,
      eventTitle:    confirmed.events.title,
      eventDate:     confirmed.events.date,
      eventLocation: confirmed.events.location,
      stallLabel:    confirmed.stalls?.label,
      paidPrice:     Number(confirmed.paid_price ?? 0),
      vendorName:    confirmed.vendor_name,
    })
    await sendEmail({
      to:      confirmed.vendor_email,
      subject: tpl.subject,
      html:    tpl.html,
      text:    tpl.text,
    })
  }
}

async function handleCheckoutExpired(supabase, session) {
  const bookingId = session.metadata?.booking_id
  if (!bookingId) return

  // Annulliamo solo se ancora pending. Se gia' confirmed (race tra completed
  // e expired), lasciamo confirmed: il pagamento c'e', l'evento expired
  // arriva tardi.
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('status', 'pending')

  if (error) throw error
}
