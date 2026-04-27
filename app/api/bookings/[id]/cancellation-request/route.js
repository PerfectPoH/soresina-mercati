import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import { runValidators, validateUuid, validateString } from '@/lib/validate'

// POST /api/bookings/[id]/cancellation-request
// Il venditore richiede l'annullamento della propria prenotazione. La
// richiesta entra in coda admin che decide se rimborsare. Body opzionale:
// { reason: 'Non posso piu' partecipare' }
export async function POST(request, { params }) {
  try {
    const limited = enforceRateLimit(request, {
      prefix: 'booking-cancel-request',
      limit: 10,
      windowMs: 60_000,
    })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) {
      return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const v = runValidators([
      ['reason', validateString(body.reason, { field: 'Motivo', required: false, max: 500 })],
    ])
    if (!v.ok) return NextResponse.json({ error: 'invalid_input', message: v.error }, { status: 400 })
    const { reason } = v.data

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'not_authenticated', message: 'Devi accedere.' },
        { status: 401 }
      )
    }

    // Rate limit per-utente: max 5 richieste/min
    const userLimited = enforceRateLimit(request, {
      prefix: 'booking-cancel-user',
      limit: 5,
      windowMs: 60_000,
      keyExtra: user.id,
    })
    if (userLimited) return userLimited

    // La funzione DB ha tutti i check di ownership e stato (vedi
    // request_booking_cancellation in schema).
    const { data: ok, error } = await supabase.rpc('request_booking_cancellation', {
      p_booking_id: params.id,
      p_reason:     reason || null,
    })

    if (error) {
      safeLogError('[cancellation-request] rpc error', error)
      return NextResponse.json(
        { error: error.code || 'request_failed', message: error.message },
        { status: 400 }
      )
    }
    if (!ok) {
      return NextResponse.json(
        { error: 'not_eligible', message: 'Questa prenotazione non puo\' essere oggetto di richiesta cancellazione.' },
        { status: 400 }
      )
    }

    try {
      revalidatePath('/profilo')
      revalidatePath('/admin')
      revalidatePath('/admin/cancellazioni')
    } catch (_) {}

    return NextResponse.json({ ok: true })
  } catch (err) {
    safeLogError('[cancellation-request] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
