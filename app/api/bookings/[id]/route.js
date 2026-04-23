import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import { validateUuid } from '@/lib/validate'

// DELETE /api/bookings/[id]
// Annulla una prenotazione (soft delete: status = 'cancelled').
// Solo admin puo' annullare prenotazioni (RLS bookings_admin_update).
export async function DELETE(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'bookings-delete', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })

    const supabase = createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'not_authenticated', message: 'Devi accedere.' },
        { status: 401 }
      )
    }

    // Verifica ruolo admin (difesa in profondita': c'e' gia' RLS lato DB)
    const { data: vendor } = await supabase
      .from('vendors')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!vendor || vendor.role !== 'admin') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Solo gli admin possono annullare prenotazioni.' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json(
        { error: error.code || 'update_failed', message: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    safeLogError('[api/bookings DELETE] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
