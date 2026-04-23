import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import {
  runValidators,
  validateString,
  validateUuid,
  validateEnum,
  GOODS_TYPES,
} from '@/lib/validate'

// API route per creare una prenotazione.
// Gira lato server per leggere i cookie httpOnly della sessione.
export async function POST(request) {
  try {
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

    // 5. Insert. Il trigger enforce_booking_limit + l'indice unique
    //    bookings_one_confirmed_per_stall fanno da doppia garanzia
    //    contro race condition e doppie prenotazioni.
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
        status:       'confirmed',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.code || 'insert_failed', message: error.message },
        { status: 400 }
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

    return NextResponse.json({ data })
  } catch (err) {
    safeLogError('[api/book] unexpected error', err)
    return NextResponse.json(
      { error: 'unexpected', message: 'Errore del server.' },
      { status: 500 }
    )
  }
}
