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

    const { data, error } = await supabase
      .from('stalls')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.code || 'update_failed', message: error.message },
        { status: 400 }
      )
    }
    return NextResponse.json({ data })
  } catch (err) {
    safeLogError('[api/stalls PATCH] unexpected error', err)
    return NextResponse.json(
      { error: 'unexpected', message: 'Errore del server.' },
      { status: 500 }
    )
  }
}
