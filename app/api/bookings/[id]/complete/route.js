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
//   - Se l'evento è gratuito (amount = 0) → conferma immediata via admin client.
//   - Se l'evento ha un prezzo > 0 → genera nuova Stripe checkout session
//     e ritorna l'URL al client per redirect.
//
// Server-side check obbligatori:
//   - booking è del chiamante (o admin)
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
        id, user_id, status, stall_id, event_id,
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

    // Ownership check (admin può completare per chiunque, utility di rescue)
    if (b.user_id !== user.id) {
      const { data: vendor } = await supabase
        .from('vendors').select('role').eq('user_id', user.id).maybeSingle()
      if (!vendor || vendor.role !== 'admin') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    if (b.status !== 'pending') {
      return NextResponse.json(
        { error: 'wrong_status', message: `Questa prenotazione è già in stato "${b.status}", non può essere completata.` },
        { status: 400 }
      )
    }

    const ev    = b.events
    const stall = b.stalls
    const todayIso = new Date().toISOString().slice(0, 10)
    if (!ev || !ev.active || !ev.date || ev.date < todayIso) {
      return NextResponse.json(
        { error: 'event_past_or_archived', message: 'Questo mercato non è più disponibile per la prenotazione.' },
        { status: 400 }
      )
    }

    const amountToPay = stall?.price ?? ev.price_per_stall ?? 0

    // Caso evento gratuito: conferma immediata, niente Stripe.
    if (Number(amountToPay) === 0) {
      const { error: confirmErr } = await admin
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', params.id)
        .eq('status', 'pending')
      if (confirmErr) {
        safeLogError('[booking/complete] free confirm failed', confirmErr)
        return NextResponse.json({ error: 'confirm_failed', message: confirmErr.message }, { status: 500 })
      }
      try {
        revalidatePath(`/prenotato/${params.id}`)
        revalidatePath('/profilo')
        if (b.event_id) revalidatePath(`/evento/${b.event_id}`)
      } catch (_) {}
      return NextResponse.json({ ok: true, free: true, checkoutUrl: null })
    }

    // Caso a pagamento: crea nuova Stripe checkout session
    if (!stripe) {
      return NextResponse.json(
        { error: 'stripe_not_configured', message: 'Stripe non configurato.' },
        { status: 500 }
      )
    }
    let session
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: `Prenotazione posteggio ${stall?.label ?? ''} - ${ev.title}` },
            unit_amount: Math.round(Number(amountToPay) * 100),
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

    return NextResponse.json({ ok: true, free: false, checkoutUrl: session.url })
  } catch (err) {
    safeLogError('[booking/complete] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
