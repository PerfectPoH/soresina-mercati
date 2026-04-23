import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import {
  runValidators,
  validateUuid,
  validateString,
  validateIsoDate,
  validateNumber,
} from '@/lib/validate'

async function requireAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'not_authenticated', message: 'Devi accedere come admin.' }, { status: 401 }) }
  const { data: vendor } = await supabase.from('vendors').select('role').eq('user_id', user.id).maybeSingle()
  if (!vendor || vendor.role !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden', message: 'Solo gli admin possono modificare eventi.' }, { status: 403 }) }
  }
  return { user, vendor }
}

// DELETE /api/events/[id]
export async function DELETE(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'events-delete', limit: 20, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })

    const supabase = createSupabaseServerClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const { error } = await supabase.from('events').delete().eq('id', params.id)
    if (error) {
      return NextResponse.json({ error: error.code || 'delete_failed', message: error.message }, { status: 400 })
    }
    try {
      revalidatePath('/')
      revalidatePath('/admin')
      revalidatePath(`/evento/${params.id}`)
    } catch (_) {}
    return NextResponse.json({ success: true })
  } catch (err) {
    safeLogError('[api/events DELETE] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}

// PATCH /api/events/[id]
export async function PATCH(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'events-patch', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const supabase = createSupabaseServerClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    // Validazione dei soli campi presenti
    const update = {}
    if (typeof body.active === 'boolean') update.active = body.active

    if (body.title !== undefined) {
      const r = validateString(body.title, { field: 'Titolo', min: 2, max: 120 })
      if (!r.ok) return NextResponse.json({ error: 'invalid_input', message: r.error }, { status: 400 })
      update.title = r.value
    }
    if (body.description !== undefined) {
      const r = validateString(body.description, { field: 'Descrizione', required: false, max: 2000 })
      if (!r.ok) return NextResponse.json({ error: 'invalid_input', message: r.error }, { status: 400 })
      update.description = r.value
    }
    if (body.date !== undefined) {
      const r = validateIsoDate(body.date, { field: 'Data' })
      if (!r.ok) return NextResponse.json({ error: 'invalid_input', message: r.error }, { status: 400 })
      update.date = r.value
    }
    if (body.location !== undefined) {
      const r = validateString(body.location, { field: 'Luogo', required: false, max: 200 })
      if (!r.ok) return NextResponse.json({ error: 'invalid_input', message: r.error }, { status: 400 })
      update.location = r.value || 'Piazza Garibaldi, Soresina'
    }
    if (body.price_per_stall !== undefined) {
      const r = validateNumber(body.price_per_stall, { field: 'Prezzo', min: 0, max: 1000 })
      if (!r.ok) return NextResponse.json({ error: 'invalid_input', message: r.error }, { status: 400 })
      update.price_per_stall = r.value
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'no_changes', message: 'Nessun campo da aggiornare.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('events')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.code || 'update_failed', message: error.message }, { status: 400 })
    }
    // Edit o archiviazione evento: invalida home (lista mercati attivi),
    // dashboard admin (lista con filtri), e la pagina evento stessa.
    try {
      revalidatePath('/')
      revalidatePath('/admin')
      revalidatePath(`/evento/${params.id}`)
    } catch (_) {}
    return NextResponse.json({ data })
  } catch (err) {
    safeLogError('[api/events PATCH] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
