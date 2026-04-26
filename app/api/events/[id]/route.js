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
  validateInt,
  validateUrl,
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

    // BUG-016: select('id') per verificare quante righe sono state cancellate.
    // Se RLS blocca o ID non esiste, data e' [] e dobbiamo rispondere 404
    // anziche' fingere un success silenzioso.
    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('id', params.id)
      .select('id')
    if (error) {
      return NextResponse.json({ error: error.code || 'delete_failed', message: error.message }, { status: 400 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Evento non trovato o non autorizzato.' }, { status: 404 })
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
    if (body.image_url !== undefined) {
      // Stringa vuota -> rimuovi immagine esistente
      if (body.image_url === '' || body.image_url === null) {
        update.image_url = null
      } else {
        const r = validateUrl(body.image_url, { field: 'URL immagine', required: false })
        if (!r.ok) return NextResponse.json({ error: 'invalid_input', message: r.error }, { status: 400 })
        update.image_url = r.value
      }
    }

    // Centro + zoom della mappa satellite. Impostati dall'admin via
    // "Centra mappa qui" nel geo-editor oppure modificati in bulk dalla
    // dashboard admin. Range globali (lat ±90, lng ±180, zoom 1-22).
    //
    // BUG-017: lat e lng devono essere aggiornate insieme (stesso pattern di
    // stalls.latitude/longitude). Un evento con solo lat o solo lng e' geo
    // incoerente. Accettiamo: (a) entrambe valide, (b) entrambe null per
    // resettare, oppure (c) nessuna delle due nel body. Mai una sola.
    const hasLat = body.map_lat !== undefined
    const hasLng = body.map_lng !== undefined
    if (hasLat !== hasLng) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'map_lat e map_lng devono essere aggiornate insieme.' },
        { status: 400 }
      )
    }
    if (hasLat && hasLng) {
      // Entrambi null = reset coordinate
      if (body.map_lat === null && body.map_lng === null) {
        update.map_lat = null
        update.map_lng = null
      } else {
        const rLat = validateNumber(body.map_lat, { field: 'Latitudine mappa', min: -90, max: 90 })
        if (!rLat.ok) return NextResponse.json({ error: 'invalid_input', message: rLat.error }, { status: 400 })
        const rLng = validateNumber(body.map_lng, { field: 'Longitudine mappa', min: -180, max: 180 })
        if (!rLng.ok) return NextResponse.json({ error: 'invalid_input', message: rLng.error }, { status: 400 })
        update.map_lat = rLat.value
        update.map_lng = rLng.value
      }
    }
    if (body.map_zoom !== undefined) {
      const r = validateInt(body.map_zoom, { field: 'Zoom mappa', min: 1, max: 22 })
      if (!r.ok) return NextResponse.json({ error: 'invalid_input', message: r.error }, { status: 400 })
      update.map_zoom = r.value
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'no_changes', message: 'Nessun campo da aggiornare.' }, { status: 400 })
    }

    // BUG-016: usiamo .select().maybeSingle() per distinguere "non trovato"
    // (RLS o ID inesistente) da "errore". .single() farebbe esplodere su 0 row.
    const { data, error } = await supabase
      .from('events')
      .update(update)
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.code || 'update_failed', message: error.message }, { status: 400 })
    }
    if (!data) {
      return NextResponse.json({ error: 'not_found', message: 'Evento non trovato o non autorizzato.' }, { status: 404 })
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
