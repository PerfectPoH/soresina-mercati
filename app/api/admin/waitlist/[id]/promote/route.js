import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import { validateUuid } from '@/lib/validate'

// POST /api/admin/waitlist/[id]/promote
// L'admin promuove manualmente un'iscrizione waitlist. Funziona se:
// - l'iscrizione ha stall_id specifico → crea booking pending su quel posto
// - l'iscrizione e' generale (stall_id NULL) → cerchiamo un posto free
//   nell'evento e ci creiamo il pending. Se nessun posto e' libero → 400.
// Il booking creato ha 24h per essere pagato (gestito da
// release_expired_waitlist_promotions cron).
export async function POST(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'admin-waitlist-promote', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    const { data: vendor } = await supabase
      .from('vendors').select('role').eq('user_id', user.id).maybeSingle()
    if (!vendor || vendor.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden', message: 'Solo admin.' }, { status: 403 })
    }

    const admin = createSupabaseAdminClient()

    // Carica l'entry waitlist + i dati dell'evento per il check.
    const { data: entry, error: loadErr } = await admin
      .from('waitlist')
      .select('id, event_id, stall_id, user_id, vendor_name, events ( date, active )')
      .eq('id', params.id)
      .maybeSingle()
    if (loadErr) {
      safeLogError('[admin/waitlist/promote] load entry failed', loadErr)
      return NextResponse.json({ error: 'load_failed' }, { status: 500 })
    }
    if (!entry) {
      return NextResponse.json({ error: 'not_found', message: 'Iscrizione non trovata.' }, { status: 404 })
    }

    // BUG-042: difesa in profondita' contro promote su eventi passati
    // (la funzione DB rifiuta gia', ma diamo un errore chiaro alla UI).
    const todayIso = new Date().toISOString().slice(0, 10)
    const ev       = entry.events
    if (!ev || !ev.active || (ev.date && ev.date < todayIso)) {
      return NextResponse.json(
        { error: 'event_past_or_archived', message: 'Non puoi promuovere su un evento passato o archiviato. Rimuovi l\'iscrizione invece.' },
        { status: 400 }
      )
    }

    // Decidi lo stall: se entry.stall_id e' valorizzato, usalo. Se non lo è,
    // trova il primo stall free per quell'evento.
    let stallId = entry.stall_id
    if (!stallId) {
      const { data: freeStall } = await admin
        .from('stalls_with_status')
        .select('id')
        .eq('event_id', entry.event_id)
        .eq('stall_status', 'free')
        .order('row_idx').order('col_idx')
        .limit(1)
        .maybeSingle()
      if (!freeStall) {
        return NextResponse.json(
          { error: 'no_free_stall', message: 'Nessun posto libero in questo evento. Libera prima un posteggio.' },
          { status: 400 }
        )
      }
      stallId = freeStall.id
    }

    // Chiama la funzione DB che fa tutto il lavoro (insert booking pending +
    // delete waitlist entry + gestione errori limite/conflict).
    const { data: bookingId, error: rpcErr } = await admin.rpc('promote_next_waitlist', {
      p_event_id: entry.event_id,
      p_stall_id: stallId,
    })
    if (rpcErr) {
      safeLogError('[admin/waitlist/promote] rpc failed', rpcErr)
      return NextResponse.json({ error: 'promote_failed', message: rpcErr.message }, { status: 500 })
    }
    if (!bookingId) {
      return NextResponse.json(
        { error: 'no_eligible', message: 'Nessuna iscrizione eleggibile (forse l\'utente è al limite o il posto è occupato).' },
        { status: 400 }
      )
    }

    try {
      revalidatePath('/admin/lista-attesa')
      revalidatePath('/admin')
      revalidatePath(`/evento/${entry.event_id}`)
      revalidatePath('/profilo')
    } catch (_) {}

    return NextResponse.json({ ok: true, booking_id: bookingId, stall_id: stallId })
  } catch (err) {
    safeLogError('[admin/waitlist/promote] unexpected error', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
