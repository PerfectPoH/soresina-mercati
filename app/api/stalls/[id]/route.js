import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import { validateUuid, validateString } from '@/lib/validate'

// PATCH /api/stalls/[id]
// Solo admin: blocca / sblocca manualmente una bancarella.
// Body: { blocked: boolean, blocked_reason?: string }
export async function PATCH(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'stalls-patch', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })

    const body = await request.json().catch(() => ({}))
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
        { error: 'forbidden', message: 'Solo gli admin possono bloccare posteggi.' },
        { status: 403 }
      )
    }

    const update = {}
    if (typeof body.blocked === 'boolean') {
      update.blocked = body.blocked
      // Svuota la ragione quando si sblocca
      if (body.blocked === false) update.blocked_reason = null
    }
    if (body.blocked_reason !== undefined && update.blocked !== false) {
      const r = validateString(body.blocked_reason, { field: 'Motivo', required: false, max: 200 })
      if (!r.ok) return NextResponse.json({ error: 'invalid_input', message: r.error }, { status: 400 })
      update.blocked_reason = r.value
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'no_changes', message: 'Nessun campo da aggiornare.' }, { status: 400 })
    }

    // Prima verifica che la stall esista davvero, cosi' distinguiamo
    // "non trovata" da "RLS blocca l'update". Se usassimo direttamente
    // .update().select().single() e l'update tocca 0 righe, PostgREST
    // ritorna l'errore criptico "Cannot coerce the result to a single
    // JSON object" e non si capisce cosa sia successo.
    const { data: existing, error: findError } = await supabase
      .from('stalls')
      .select('id')
      .eq('id', params.id)
      .maybeSingle()

    if (findError) {
      return NextResponse.json(
        { error: findError.code || 'lookup_failed', message: findError.message },
        { status: 400 }
      )
    }
    if (!existing) {
      return NextResponse.json(
        { error: 'not_found', message: 'Posteggio non trovato.' },
        { status: 404 }
      )
    }

    // Update senza .single() per evitare l'errore "Cannot coerce...":
    // se RLS rifiuta silenziosamente, `data` arriva come array vuoto e
    // possiamo dare un messaggio umano invece del codice PostgREST.
    const { data, error } = await supabase
      .from('stalls')
      .update(update)
      .eq('id', params.id)
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.code || 'update_failed', message: error.message },
        { status: 400 }
      )
    }
    if (!data || data.length === 0) {
      // Arriva qui quando la RLS policy "stalls_admin_update" non esiste
      // o is_admin() torna false. Il check admin all'inizio e' gia' passato,
      // quindi il problema e' nelle policy del DB — da rieseguire.
      return NextResponse.json(
        {
          error: 'rls_blocked',
          message: 'Update bloccato dalle policy del database. Riesegui security-migration.sql.',
        },
        { status: 403 }
      )
    }
    return NextResponse.json({ data: data[0] })
  } catch (err) {
    safeLogError('[api/stalls PATCH] unexpected error', err)
    return NextResponse.json(
      { error: 'unexpected', message: 'Errore del server.' },
      { status: 500 }
    )
  }
}
