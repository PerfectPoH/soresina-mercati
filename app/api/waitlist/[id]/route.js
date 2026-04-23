import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import { validateUuid } from '@/lib/validate'

// DELETE /api/waitlist/[id]
// Il venditore (o l'admin) rimuove un'iscrizione alla lista d'attesa.
export async function DELETE(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'waitlist-delete', limit: 20, windowMs: 60_000 })
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

    // La RLS consente la DELETE solo al proprietario o all'admin
    const { error } = await supabase
      .from('waitlist')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json(
        { error: error.code || 'delete_failed', message: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    safeLogError('[api/waitlist DELETE] unexpected error', err)
    return NextResponse.json(
      { error: 'unexpected', message: 'Errore del server.' },
      { status: 500 }
    )
  }
}
