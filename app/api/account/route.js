import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'

// DELETE /api/account
// GDPR Art. 17 "diritto all'oblio": l'utente autenticato cancella
// il proprio account. La logica e' nella funzione SECURITY DEFINER
// public.delete_my_account() (vedi supabase/gdpr-migration.sql),
// che rimuove vendor, bookings, waitlist e la riga auth.users.
// Dopo la cancellazione la sessione non e' piu' valida: il client
// deve ricaricare la pagina / fare logout.
export async function DELETE(request) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'account-delete', limit: 3, windowMs: 60_000 })
    if (limited) return limited

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'not_authenticated', message: 'Devi accedere.' },
        { status: 401 }
      )
    }

    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      // Non logghiamo l'email dell'utente per non sporcare i log con PII.
      safeLogError('[api/account DELETE] rpc error', error)
      return NextResponse.json(
        { error: error.code || 'delete_failed', message: 'Impossibile completare la cancellazione. Riprova.' },
        { status: 400 }
      )
    }

    // Pulisci la sessione sul server (i cookie httpOnly di Supabase)
    try {
      await supabase.auth.signOut()
    } catch (_) {
      // best effort: se fallisce, l'utente verra' loggato fuori al prossimo giro
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    safeLogError('[api/account DELETE] unexpected', err)
    return NextResponse.json(
      { error: 'unexpected', message: 'Errore del server.' },
      { status: 500 }
    )
  }
}
