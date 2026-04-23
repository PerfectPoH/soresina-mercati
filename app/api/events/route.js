import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import {
  runValidators,
  validateString,
  validateIsoDate,
  validateInt,
  validateNumber,
} from '@/lib/validate'

// POST /api/events
// Crea un nuovo evento + genera automaticamente le bancarelle.
export async function POST(request) {
  try {
    const limited = enforceRateLimit(request, {
      prefix: 'events-post',
      limit: 10,
      windowMs: 60_000,
    })
    if (limited) return limited

    const body = await request.json().catch(() => ({}))

    const v = runValidators([
      ['title',           validateString(body.title,       { field: 'Titolo', min: 2, max: 120 })],
      ['description',     validateString(body.description, { field: 'Descrizione', required: false, max: 2000 })],
      ['date',            validateIsoDate(body.date,       { field: 'Data' })],
      ['location',        validateString(body.location,    { field: 'Luogo', required: false, max: 200 })],
      ['rows',            validateInt(body.rows,           { field: 'Righe', min: 1, max: 10 })],
      ['cols',            validateInt(body.cols,           { field: 'Colonne', min: 1, max: 20 })],
      ['price_per_stall', validateNumber(body.price_per_stall, { field: 'Prezzo', min: 0, max: 1000 })],
    ])
    if (!v.ok) return NextResponse.json({ error: 'invalid_input', message: v.error }, { status: 400 })
    const { title, description, date, location, rows, cols, price_per_stall } = v.data

    const supabase = createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'not_authenticated', message: 'Devi accedere come admin.' },
        { status: 401 }
      )
    }

    const { data: vendor } = await supabase
      .from('vendors')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor || vendor.role !== 'admin') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Solo gli admin possono creare eventi.' },
        { status: 403 }
      )
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title,
        description:     description || null,
        date,
        location:        location || 'Piazza Garibaldi, Soresina',
        rows,
        cols,
        price_per_stall,
        active:          true,
      })
      .select()
      .single()

    if (eventError) {
      return NextResponse.json(
        { error: eventError.code || 'insert_failed', message: eventError.message },
        { status: 400 }
      )
    }

    const { error: stallsError } = await supabase.rpc('generate_stalls', {
      p_event_id: event.id,
    })

    if (stallsError) {
      return NextResponse.json(
        {
          data: event,
          warning: 'stalls_failed',
          message: `Evento creato ma generazione bancarelle fallita: ${stallsError.message}`,
        },
        { status: 207 }
      )
    }

    // Nuovo evento visibile in home + dashboard admin.
    try {
      revalidatePath('/')
      revalidatePath('/admin')
    } catch (_) {}

    return NextResponse.json({ data: event })
  } catch (err) {
    safeLogError('[api/events POST] unexpected error', err)
    return NextResponse.json(
      { error: 'unexpected', message: 'Errore del server.' },
      { status: 500 }
    )
  }
}
