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
//     e ritorna l'URL al client per redirect.
//
// Server-side check obbligatori:
//   - booking e' del chiamante (o admin)
//   - status = 'pending'
//   - evento esiste, attivo, non passato
//   - posto/event coerenti
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

    // Carica booking + dati evento/posto. Usiamo l'admin client (service
    // role) per garantire che il check ownership avvenga sempre, anche se
    // RLS dovesse essere temporaneamente fuori sync.
    const admin = createSupabaseAdminClient()
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

    // Ownership check (admin puo' completare per chiunque, utility di rescue)
    if (b.user_id !== user.id) {
      const { data: vendor } = await supabase
        .from('vendors').select('role').eq('user_id', user.id).maybeSingle()
      if (!vendor || vendor.role !== 'admin') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    if (b.status !== 'pending') {
      return NextResponse.json(
        { error: 'wrong_status', message: `Questa prenotazione e' gia' in stato "${b.status}", non puo' essere completata.` },
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

    // BUG-047: snapshot prezzo. Se paid_price esiste gia' (es. booking da
    // waitlist promosso dalla funzione DB), non va riscritto: e' il prezzo
    // promesso all'utente quando il pending e' nato.

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

    // Per booking vecchi senza snapshot, congeliamo il prezzo una sola volta
    // prima di creare la sessione Stripe.
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

    // Caso a pagamento: crea nuova Stripe checkout session
    if (!stripe) {
      return NextResponse.json(
        { error: 'stripe_not_configured', message: 'Stripe non configurato.' },
        { status: 500 }
      )
    }

    // BUG-052 (Codex audit 2026-05-04): idempotency. Se il booking ha gia'
    // una Stripe Checkout session attiva (creata in un precedente tentativo
    // di completamento, doppio click, refresh), riusiamola invece di crearne
    // una nuova. Cosi' due tab che chiamano /complete portano alla stessa
    // checkout, evitando il rischio di doppio pagamento.
    let session = null
    if (b.stripe_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(b.stripe_session_id)
        if (existing.status === 'complete' || existing.payment_status === 'paid') {
          // Pagamento gia' avvenuto: il webhook dovrebbe star confermando.
          // Restituiamo OK senza checkout url: il client torna a /prenotato/[id]
          // che mostrera' "Prenotazione confermata!" appena arriva il webhook.
          return NextResponse.json({ ok: true, free: false, checkoutUrl: null, alreadyPaid: true })
        }
        if (existing.status === 'open' && existing.url) {
          // Sessione ancora valida: la riusiamo.
          session = existing
        }
        // status 'expired' (Stripe scade le sessioni dopo 24h) → cadiamo
        // sul flow di creazione nuova sessione qui sotto.
      } catch (retrieveErr) {
        // Session non recuperabile (forse cancellata da Stripe dashboard,
        // o id non valido): procediamo a crearne una nuova. Loghiamo per
        // tracciare ma non blocchiamo il flow.
        safeLogError('[booking/complete] stripe session retrieve failed (creating new)', retrieveErr)
      }
    }

    if (!session) {
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
        return NextResponse.json(
          { error: 'stripe_failed', message: stripeErr?.message || 'Errore Stripe' },
          { status: 502 }
        )
      }

      // Salviamo subito stripe_session_id sul booking. Cosi' la prossima
      // chiamata al /complete (doppio click, retry, altro tab) la trova e
      // la riusa invece di creare un duplicato. Best-effort: se questa
      // UPDATE fallisce non rolliamo back la session Stripe (l'utente puo'
      // pagare comunque), ma logghiamo per visibilita'.
      const { error: claimErr } = await admin
        .from('bookings')
        .update({ stripe_session_id: session.id })
        .eq('id', params.id)
        .eq('status', 'pending')
      if (claimErr) {
        safeLogError('[booking/complete] stripe_session_id claim failed', claimErr)
      }
    }

    return NextResponse.json({ ok: true, free: false, checkoutUrl: session.url })
  } catch (err) {
    safeLogError('[booking/complete] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
