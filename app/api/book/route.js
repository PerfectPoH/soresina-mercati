import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import Stripe from 'stripe'
import {
  runValidators,
  validateString,
  validateUuid,
  validateEnum,
  GOODS_TYPES,
} from '@/lib/validate'

// BUG-014: agent debug instrumentation. La funzione e' un no-op per default.
// Si attiva solo in dev locale settando AGENT_DEBUG_INGEST_URL nell'env (con
// session id generata a runtime). Cosi' non ci sono fetch a localhost da prod.
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

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) 
  : null;

// API route per creare una prenotazione.
// Gira lato server per leggere i cookie httpOnly della sessione.
export async function POST(request) {
  try {
    debugLog('H5', 'app/api/book/route.js:POST:entry', 'book api entry', {
      hasStripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
      hasSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    })
    // 1. Rate limit: max 10 prenotazioni/minuto per IP.
    const limited = enforceRateLimit(request, {
      prefix: 'book',
      limit: 10,
      windowMs: 60_000,
    })
    if (limited) return limited

    const body = await request.json().catch(() => ({}))

    // 2. Validazione + sanitizzazione input
    const v = runValidators([
      ['stall_id',   validateUuid(body.stall_id,   { field: 'stall_id' })],
      ['event_id',   validateUuid(body.event_id,   { field: 'event_id' })],
      ['goods_type', validateEnum(body.goods_type, GOODS_TYPES, { field: 'goods_type' })],
      ['notes',      validateString(body.notes,    { field: 'Note', required: false, max: 500 })],
    ])
    if (!v.ok) {
      return NextResponse.json({ error: 'invalid_input', message: v.error }, { status: 400 })
    }
    const { stall_id, event_id, goods_type, notes } = v.data

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'not_authenticated', message: 'Devi accedere per prenotare.' },
        { status: 401 }
      )
    }

    // 3. Rate limit per-utente
    const userLimited = enforceRateLimit(request, {
      prefix: 'book-user',
      limit: 5,
      windowMs: 60_000,
      keyExtra: user.id,
    })
    if (userLimited) return userLimited

    // 4. Profilo vendor
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle()

    if (vendorError || !vendor) {
      return NextResponse.json(
        { error: 'no_profile', message: 'Profilo venditore non trovato.' },
        { status: 400 }
      )
    }

    // 5. Ottieni info sui prezzi (stall o event).
    // BUG-020: filtriamo SIA su id SIA su event_id per evitare che un client
    // mandi (stall_id di evento A, event_id di evento B): senza il filtro
    // event_id, la stall verrebbe trovata e si calcolerebbe il prezzo del
    // suo evento "vero" mentre il booking verrebbe creato sull'event_id
    // sbagliato. .maybeSingle() per non esplodere su 0 row.
    const { data: stallData, error: stallErr } = await supabase
      .from('stalls_with_status')
      .select('price, default_price, event_title, label, event_id, event_date')
      .eq('id', stall_id)
      .eq('event_id', event_id)
      .maybeSingle()

    if (stallErr) {
      safeLogError('[api/book] stall lookup failed', stallErr)
      return NextResponse.json(
        { error: 'stall_lookup_failed', message: 'Errore nel verificare il posteggio.' },
        { status: 500 }
      )
    }
    if (!stallData) {
      return NextResponse.json(
        { error: 'stall_not_found', message: 'Posteggio non trovato per questo evento.' },
        { status: 404 }
      )
    }

    // BUG-037: niente prenotazioni su eventi passati (controllo server-side
    // anche oltre alla UI, per evitare bypass via curl o client malevolo).
    const todayIso = new Date().toISOString().slice(0, 10)
    if (stallData.event_date && stallData.event_date < todayIso) {
      return NextResponse.json(
        { error: 'event_past', message: 'Questo mercato si è già svolto e non è più prenotabile.' },
        { status: 400 }
      )
    }

    // BUG-015: nullish coalescing per supportare prezzo 0 (eventi gratuiti).
    // `||` considera 0 come falsy e ricadrebbe sui default, addebitando soldi
    // a chi ha esplicitamente impostato un mercato gratuito.
    const amountToPay = stallData.price ?? stallData.default_price ?? 35.00

    // 6. Insert in status pending
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        stall_id,
        event_id,
        user_id:      user.id,
        vendor_name:  vendor.name,
        vendor_phone: vendor.phone,
        vendor_email: vendor.email,
        goods_type,
        notes:        notes || null,
        status:       'pending',
      })
      .select()
      .single()

    debugLog('H5', 'app/api/book/route.js:POST:booking_insert_result', 'booking insert result', {
      hasInsertError: Boolean(error),
      insertErrorCode: error?.code || null,
      bookingId: data?.id || null,
    })

    if (error) {
      return NextResponse.json(
        { error: error.code || 'insert_failed', message: error.message },
        { status: 400 }
      )
    }

    // 7. Caso eventi gratuiti (BUG-015 follow-up + BUG-035): se amountToPay === 0
    // saltiamo Stripe e confermiamo subito. Stripe Checkout non accetta
    // unit_amount=0 e non avrebbe senso pagare 0 EUR.
    //
    // BUG-035: l'UPDATE pending→confirmed deve usare il client ADMIN (service
    // role) perche' la policy bookings_admin_update richiede is_admin().
    // Se usiamo il client cookie-based, RLS scarta l'update silenziosamente
    // e il booking resta pending nonostante l'API risponda 200.
    if (amountToPay === 0) {
      const adminSb = createSupabaseAdminClient()
      const { error: confirmErr } = await adminSb
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', data.id)
        .eq('status', 'pending')
      if (confirmErr) {
        await rollbackPendingBooking(supabase, data.id)
        safeLogError('[api/book] free booking confirm failed', confirmErr)
        return NextResponse.json(
          { error: 'confirm_failed', message: 'Errore confermando la prenotazione gratuita.' },
          { status: 500 }
        )
      }
      try {
        revalidatePath(`/evento/${event_id}`)
        revalidatePath('/profilo')
        revalidatePath('/admin')
      } catch (_) {}
      return NextResponse.json({ data: { ...data, status: 'confirmed' }, checkoutUrl: null })
    }

    // 8. Crea sessione Stripe.
    // Se Stripe fallisce (network, invalid key, ecc.) dobbiamo annullare il
    // booking 'pending' appena inserito: altrimenti il posteggio resta
    // bloccato senza una sessione di checkout valida, finche' il GC dei
    // pending non lo libera (15 min). Meglio liberare subito.
    if (!stripe) {
      debugLog('H5', 'app/api/book/route.js:POST:missing_stripe_secret', 'missing stripe secret before checkout')
      await rollbackPendingBooking(supabase, data.id)
      throw new Error('STRIPE_SECRET_KEY non configurata sul server')
    }
    let session
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `Prenotazione posteggio ${stallData?.label} - ${stallData?.event_title}`,
              },
              unit_amount: Math.round(amountToPay * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/prenotato/${data.id}?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/evento/${event_id}?canceled=true`,
        metadata: {
          booking_id: data.id,
          stall_id: stall_id,
          event_id: event_id
        }
      })
      debugLog('H5', 'app/api/book/route.js:POST:checkout_created', 'stripe checkout created', {
        bookingId: data.id,
        hasCheckoutUrl: Boolean(session?.url),
        checkoutSessionId: session?.id || null,
      })
    } catch (stripeErr) {
      safeLogError('[api/book] stripe checkout session create failed', stripeErr)
      debugLog('H5', 'app/api/book/route.js:POST:checkout_failed', 'stripe checkout create failed', {
        bookingId: data.id,
        errorCode: stripeErr?.code || null,
        errorName: stripeErr?.name || null,
      })
      await rollbackPendingBooking(supabase, data.id)
      return NextResponse.json(
        { error: 'stripe_failed', message: 'Errore nel creare la sessione di pagamento. Riprova.' },
        { status: 502 }
      )
    }

    // Invalida la client router cache di Next.js per le pagine che mostrano
    // questa prenotazione. Senza questo, navigando via e tornando indietro
    // (es. da /prenotato/:id torno a /evento/:id) il browser mostra ancora
    // il posteggio come "libero" fino ad un hard refresh.
    // Su mobile questo si nota di piu' perche' il websocket di Realtime
    // viene messo in pausa dal browser quando la scheda non e' in foreground.
    try {
      revalidatePath(`/evento/${event_id}`)
      revalidatePath('/profilo')
      revalidatePath('/admin')
    } catch (_) {
      // revalidatePath puo' fallire in edge cases (build time, preview);
      // non e' fatale per la prenotazione appena creata.
    }

    return NextResponse.json({ data, checkoutUrl: session.url })
  } catch (err) {
    safeLogError('[api/book] unexpected error', err)
    return NextResponse.json(
      { error: 'unexpected', message: 'Errore del server.' },
      { status: 500 }
    )
  }
}

// Cleanup di un booking pending quando il flusso Stripe fallisce subito dopo
// l'insert. Best effort: se anche questo update fallisce, sara' il GC dei
// pending a liberare il posteggio (entro 15 min dal pg_cron).
async function rollbackPendingBooking(supabase, bookingId) {
  try {
    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('status', 'pending')
  } catch (rollbackErr) {
    safeLogError('[api/book] rollback pending booking failed', rollbackErr)
  }
}
