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

// POST /api/admin/bookings/[id]/cancel
// Body: { refund: true|false }
// L'admin approva la cancellazione di una richiesta utente (o cancella
// direttamente). Se refund=true, emette il rimborso Stripe del
// payment_intent salvato sul booking.
export async function POST(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'admin-cancel', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) {
      return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const refund = body.refund !== false  // default true

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'not_authenticated', message: 'Devi accedere.' }, { status: 401 })
    }
    const { data: vendor } = await supabase
      .from('vendors').select('role').eq('user_id', user.id).maybeSingle()
    if (!vendor || vendor.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden', message: 'Solo admin.' }, { status: 403 })
    }

    // Carica booking (admin client per avere stripe_payment_intent_id)
    const admin = createSupabaseAdminClient()
    const { data: booking, error: loadErr } = await admin
      .from('bookings')
      .select('id, status, event_id, stall_id, stripe_payment_intent_id, stripe_session_id')
      .eq('id', params.id)
      .maybeSingle()

    if (loadErr) {
      safeLogError('[admin/cancel] load booking failed', loadErr)
      return NextResponse.json({ error: 'load_failed', message: loadErr.message }, { status: 500 })
    }
    if (!booking) {
      return NextResponse.json({ error: 'not_found', message: 'Prenotazione non trovata.' }, { status: 404 })
    }
    if (booking.status === 'cancelled') {
      return NextResponse.json({ ok: true, alreadyCancelled: true })
    }

    // 1. Rimborso Stripe (se richiesto e c'e' un payment_intent)
    let refundId = null
    if (refund && booking.stripe_payment_intent_id) {
      if (!stripe) {
        return NextResponse.json(
          { error: 'stripe_not_configured', message: 'Stripe non è configurato sul server. Imposta STRIPE_SECRET_KEY o usa refund=false.' },
          { status: 500 }
        )
      }
      try {
        const r = await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id })
        refundId = r.id
      } catch (stripeErr) {
        safeLogError('[admin/cancel] stripe refund failed', stripeErr)
        return NextResponse.json(
          { error: 'refund_failed', message: stripeErr?.message || 'Rimborso Stripe fallito.' },
          { status: 502 }
        )
      }
    }

    // 2. Aggiorna status booking
    const { error: updErr } = await admin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', params.id)
    if (updErr) {
      safeLogError('[admin/cancel] update booking failed', updErr)
      return NextResponse.json(
        { error: 'update_failed', message: updErr.message, refund_id: refundId },
        { status: 500 }
      )
    }

    // BUG-041: il posto si è liberato → promuovi il prossimo dalla waitlist.
    // Priorità: chi era in lista d'attesa specifica per QUESTO posto, poi la
    // lista d'attesa generale dell'evento. Best-effort: se fallisce, l'admin
    // può promuovere a mano da /admin/lista-attesa.
    let promotedBookingId = null
    if (booking.event_id && booking.stall_id) {
      const { data: promoted, error: promoteErr } = await admin.rpc('promote_next_waitlist', {
        p_event_id: booking.event_id,
        p_stall_id: booking.stall_id,
      })
      if (promoteErr) {
        safeLogError('[admin/cancel] promote_next_waitlist failed', promoteErr)
      } else {
        promotedBookingId = promoted || null
      }
    }

    try {
      revalidatePath('/admin')
      revalidatePath('/admin/cancellazioni')
      revalidatePath('/admin/lista-attesa')
      revalidatePath('/profilo')
      if (booking.event_id) revalidatePath(`/evento/${booking.event_id}`)
    } catch (_) {}

    return NextResponse.json({
      ok: true,
      refund_id: refundId,
      refunded: Boolean(refundId),
      waitlist_promoted_booking_id: promotedBookingId,
    })
  } catch (err) {
    safeLogError('[admin/cancel] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}

// DELETE /api/admin/bookings/[id]/cancel
// Rifiuta la richiesta di cancellazione (rimuove cancellation_requested_at).
export async function DELETE(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'admin-cancel-deny', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) {
      return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'not_authenticated', message: 'Devi accedere.' }, { status: 401 })
    }
    const { data: vendor } = await supabase
      .from('vendors').select('role').eq('user_id', user.id).maybeSingle()
    if (!vendor || vendor.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden', message: 'Solo admin.' }, { status: 403 })
    }

    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from('bookings')
      .update({ cancellation_requested_at: null, cancellation_reason: null })
      .eq('id', params.id)
      .select('id')

    if (error) {
      return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Prenotazione non trovata.' }, { status: 404 })
    }

    try { revalidatePath('/admin/cancellazioni'); revalidatePath('/admin') } catch (_) {}
    return NextResponse.json({ ok: true })
  } catch (err) {
    safeLogError('[admin/cancel DELETE] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
