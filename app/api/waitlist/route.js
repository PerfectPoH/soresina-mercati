import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import {
  runValidators,
  validateUuid,
  validateEnum,
  validateString,
  GOODS_TYPES,
} from '@/lib/validate'

// POST /api/waitlist
// Il venditore si iscrive alla lista d'attesa di un evento.
// Body: { event_id, goods_type, notes? }
export async function POST(request) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'waitlist-post', limit: 10, windowMs: 60_000 })
    if (limited) return limited

    const body = await request.json().catch(() => ({}))

    const v = runValidators([
      ['event_id',   validateUuid(body.event_id,   { field: 'event_id' })],
      ['goods_type', validateEnum(body.goods_type, GOODS_TYPES, { field: 'goods_type' })],
      ['notes',      validateString(body.notes,    { field: 'Note', required: false, max: 500 })],
    ])
    if (!v.ok) return NextResponse.json({ error: 'invalid_input', message: v.error }, { status: 400 })
    const { event_id, goods_type, notes } = v.data

    const supabase = createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'not_authenticated', message: 'Devi accedere per iscriverti.' },
        { status: 401 }
      )
    }

    const { data: vendor } = await supabase
      .from('vendors')
      .select('name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor) {
      return NextResponse.json(
        { error: 'no_profile', message: 'Profilo venditore non trovato.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('waitlist')
      .insert({
        event_id,
        user_id:      user.id,
        vendor_name:  vendor.name,
        vendor_phone: vendor.phone,
        vendor_email: vendor.email,
        goods_type,
        notes:        notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.code || 'insert_failed', message: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ data })
  } catch (err) {
    safeLogError('[api/waitlist POST] unexpected error', err)
    return NextResponse.json(
      { error: 'unexpected', message: 'Errore del server.' },
      { status: 500 }
    )
  }
}
