import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import { validateUuid } from '@/lib/validate'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null

// POST /api/bookings/[id]/complete
// L'utente proprietario di un booking `pending` (es. promosso da waitlist
// con 24h di tempo, o un qualsiasi pending senza Stripe session attiva)
// completa la prenotazione:
//   - Se l'evento e' gratuito (amount = 0) -> conferma immediata via admin client.
//   - Se l'evento ha un prezzo > 0 -> genera nuova Stripe checkout session
//     (o riusa quella esistente, BUG-052) e ritorna l'URL al client.
export async function POST(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'booking-complete', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'not_authenticated', message: 'Devi accedere.' }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()
    // BUG-052: includiamo stripe_session_id per riusare la session esistente.
    const { data: b, error: loadErr } = await admin
      .from('bookings')
      .select(`
        id, user_id, status, stall_id, event_id, paid_price, stripe_session_id,
        events ( id, title, date, price_per_stall, active ),
        stalls ( id, label, price )
      `)
      .eq('id', params.id)
      .maybeSingle()

    if (loadErr) {
      safeLogError('[booking/complete] load failed', loadErr)
      return NextResponse.json({ error: 'load_failed' }, { status: 500 })
    }
    if (!b) {
      return NextResponse.json({ error: 'not_found', message: 'Prenotazione non trovata.' }, { status: 404 })
    }

    if (b.user_id !== user.id) {
      const { data: vendor } = await supabase
        .from('vendors').select('role').eq('user_id', user.id).maybeSingle()
      if (!vendor || vendor.role !== 'admin') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    if (b.status !== 'pending') {
      return NextResponse.json(
        { error: 'wrong_status', message: `Questa prenotazione e' gia' in stato "${b.status}".` },
        { status: 400 }
      )
    }

    const ev    = b.events
    const stall = b.stalls
    const todayIso = new Date().toISOString().slice(0, 10)
    if (!ev || !ev.active || !ev.date || ev.date < todayIso) {
      return NextResponse.json(
        { error: 'event_past_or_archived', message: 'Questo mercato non e\' piu\' disponibile per la prenotazione.' },
        { status: 400 }
      )
    }

    const livePrice = stall?.price ?? ev.price_per_stall ?? 0
    const amountToCharge = Number(b.paid_price ?? livePrice ?? 0)
    if (!Number.isFinite(amountToCharge) || amountToCharge < 0) {
      return NextResponse.json({ error: 'invalid_price', message: 'Prezzo prenotazione non valido.' }, { status: 500 })
    }

    // BUG-047: snapshot prezzo. Se paid_price esiste gia' (booking promosso
    // da waitlist), non riscriverlo: e' il prezzo congelato all'utente.

    // Caso evento gratuito: conferma immediata, niente Stripe.
    if (amountToCharge === 0) {
      const updatePayload = { status: 'confirmed' }
      if (b.paid_price == null) updatePayload.paid_price = 0

      const { data: confirmed, error: confirmErr } = await admin
        .from('bookings')
        .update(updatePayload)
        .eq('id', params.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
      if (confirmErr) {
        safeLogError('[booking/complete] free confirm failed', confirmErr)
        return NextResponse.json({ error: 'confirm_failed', message: confirmErr.message }, { status: 500 })
      }
      if (!confirmed) {
        return NextResponse.json({ error: 'wrong_status', message: 'Questa prenotazione non e piu completabile.' }, { status: 409 })
      }
      try {
        revalidatePath(`/prenotato/${params.id}`)
        revalidatePath('/profilo')
        if (b.event_id) revalidatePath(`/evento/${b.event_id}`)
      } catch (_) {}
      return NextResponse.json({ ok: true, free: true, checkoutUrl: null })
    }

    // Snapshot paid_price se non c'e' ancora; recheck pending altrimenti.
    if (b.paid_price == null) {
      const { data: snapshotted, error: snapshotErr } = await admin
        .from('bookings')
        .update({ paid_price: amountToCharge })
        .eq('id', params.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (snapshotErr) {
        safeLogError('[booking/complete] price snapshot failed', snapshotErr)
        return NextResponse.json({ error: 'snapshot_failed', message: snapshotErr.message }, { status: 500 })
      }
      if (!snapshotted) {
        return NextResponse.json({ error: 'wrong_status', message: 'Questa prenotazione non e piu completabile.' }, { status: 409 })
      }
    } else {
      const { data: stillPending, error: pendingErr } = await admin
        .from('bookings')
        .select('id')
        .eq('id', params.id)
        .eq('status', 'pending')
        .maybeSingle()

      if (pendingErr) {
        safeLogError('[booking/complete] pending recheck failed', pendingErr)
        return NextResponse.json({ error: 'recheck_failed', message: pendingErr.message }, { status: 500 })
      }
      if (!stillPending) {
        return NextResponse.json({ error: 'wrong_status', message: 'Questa prenotazione non e piu completabile.' }, { status: 409 })
      }
    }

    // Caso a pagamento: crea o riusa Stripe checkout session
    if (!stripe) {
      return NextResponse.json(
        { error: 'stripe_not_configured', message: 'Stripe non configurato.' },
        { status: 500 }
      )
    }

    // BUG-052 (Codex audit 2026-05-04 + 2026-05-06): idempotency atomica.
    //
    // Se il booking ha gia' una stripe_session_id valida la riusiamo. Se NON ne
    // ha, dobbiamo claimare il diritto di crearne una nuova in modo atomico
    // PRIMA di chiamare Stripe — altrimenti due chiamate concorrenti (doppio
    // click, due tab) leggerebbero entrambe `stripe_session_id = null`,
    // creerebbero entrambe una session, e una sovrascriverebbe l'altra
    // generando una session orfana ma pagabile.
    //
    // Il claim usa la stessa colonna `stripe_session_id` come token di lock
    // temporaneo (`claim:<uuid>`): l'UPDATE filtra `.is('stripe_session_id', null)`,
    // quindi solo il PRIMO worker che chiama riesce a impostare il claim. Gli
    // altri ricevono 0 righe -> rileggono il booking e seguono il flow di
    // riuso della session creata dal primo worker.
    let session = null

    // STEP 1: Se la session_id esiste gia' ed e' un id Stripe vero (non un
    // claim:* token), proviamo subito a riusarla.
    if (b.stripe_session_id && !b.stripe_session_id.startsWith('claim:')) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(b.stripe_session_id)
        if (existing.status === 'complete' || existing.payment_status === 'paid') {
          return NextResponse.json({ ok: true, free: false, checkoutUrl: null, alreadyPaid: true })
        }
        if (existing.status === 'open' && existing.url) {
          session = existing
        }
        // status 'expired' / errore retrieve → cadiamo nel claim sotto.
      } catch (retrieveErr) {
        safeLogError('[booking/complete] stripe session retrieve failed (claiming new)', retrieveErr)
      }
    }

    if (!session) {
      // STEP 2: claim atomico. Generiamo un token che marca questa specifica
      // chiamata come "owner" del prossimo create. Filtriamo su null per
      // assicurare che SOLO uno tra worker concorrenti riesca a impostarlo.
      // Se esiste gia' un altro `claim:*`, vuol dire che un altro worker e'
      // a meta' del flow di create: ritorniamo `in_progress` cosi' il client
      // puo' fare retry con backoff.
      const claimToken = `claim:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const { data: claimed, error: claimErr } = await admin
        .from('bookings')
        .update({ stripe_session_id: claimToken })
        .eq('id', params.id)
        .eq('status', 'pending')
        .is('stripe_session_id', null)
        .select('id')
        .maybeSingle()

      if (claimErr) {
        safeLogError('[booking/complete] claim attempt failed', claimErr)
        return NextResponse.json({ error: 'claim_failed', message: claimErr.message }, { status: 500 })
      }

      if (!claimed) {
        // Qualcun altro ha vinto la race. Rileggiamo il booking per capire
        // se c'e' una session pronta da riusare, oppure se serve un retry.
        const { data: fresh } = await admin
          .from('bookings')
          .select('stripe_session_id, status')
          .eq('id', params.id)
          .maybeSingle()

        if (fresh?.status !== 'pending') {
          return NextResponse.json({ error: 'wrong_status', message: 'Questa prenotazione non e piu completabile.' }, { status: 409 })
        }
        if (fresh?.stripe_session_id?.startsWith('claim:')) {
          // Altro worker sta ancora creando la session. Il client riprovi.
          return NextResponse.json(
            { error: 'in_progress', message: 'Stiamo gia\' preparando il pagamento. Riprova tra un istante.' },
            { status: 409 }
          )
        }
        if (fresh?.stripe_session_id) {
          // Session reale gia' creata dall'altro worker: riusiamola.
          try {
            const existing = await stripe.checkout.sessions.retrieve(fresh.stripe_session_id)
            if (existing.status === 'complete' || existing.payment_status === 'paid') {
              return NextResponse.json({ ok: true, free: false, checkoutUrl: null, alreadyPaid: true })
            }
            if (existing.status === 'open' && existing.url) {
              return NextResponse.json({ ok: true, free: false, checkoutUrl: existing.url })
            }
          } catch (retrieveErr2) {
            safeLogError('[booking/complete] retrieve after lost-claim failed', retrieveErr2)
          }
        }
        return NextResponse.json(
          { error: 'in_progress', message: 'Stato pagamento non chiaro. Riprova tra un istante.' },
          { status: 409 }
        )
      }

      // STEP 3: noi siamo i claimer. Creiamo la session su Stripe.
      try {
        session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'eur',
              product_data: { name: `Prenotazione posteggio ${stall?.label ?? ''} - ${ev.title}` },
              unit_amount: Math.round(amountToCharge * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/prenotato/${params.id}?success=true`,
          cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/prenotato/${params.id}?canceled=true`,
          metadata: { booking_id: params.id, stall_id: b.stall_id || '', event_id: b.event_id || '' },
        })
      } catch (stripeErr) {
        safeLogError('[booking/complete] stripe session create failed', stripeErr)
        // Rilasciamo il claim cosi' un retry futuro puo' riprovare. Filtriamo
        // sul claimToken per non sovrascrivere un eventuale claim arrivato
        // dopo (paranoia).
        await admin
          .from('bookings')
          .update({ stripe_session_id: null })
          .eq('id', params.id)
          .eq('stripe_session_id', claimToken)
        return NextResponse.json(
          { error: 'stripe_failed', message: stripeErr?.message || 'Errore Stripe' },
          { status: 502 }
        )
      }

      // STEP 4: sostituiamo il claim token con l'id Stripe vero. Filtriamo
      // sul claimToken per non sovrascrivere se il booking e' gia' cambiato.
      const { error: persistErr } = await admin
        .from('bookings')
        .update({ stripe_session_id: session.id })
        .eq('id', params.id)
        .eq('stripe_session_id', claimToken)
      if (persistErr) {
        safeLogError('[booking/complete] persist session id failed', persistErr)
        // Best-effort: la session esiste comunque, ma il claim resta come
        // claim:* nel DB. Il prossimo retry vedra' "in_progress" finche'
        // un cleanup manuale o il GC waitlist non ripuliscono. Loghiamo
        // per visibilita' ma NON rompiamo il flow utente: il pagamento
        // e' valido.
      }
    }

    return NextResponse.json({ ok: true, free: false, checkoutUrl: session.url })
  } catch (err) {
    safeLogError('[booking/complete] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
