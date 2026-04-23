import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'

// POST /api/admin/retention
// Body: { action: 'anonymize' | 'purge_audit' }
// Solo admin. Lancia le funzioni SQL SECURITY DEFINER di
// supabase/gdpr-migration.sql.
async function requireAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated', status: 401 }
  const { data: vendor } = await supabase
    .from('vendors')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (vendor?.role !== 'admin') return { error: 'forbidden', status: 403 }
  return { user }
}

export async function POST(request) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'admin-retention', limit: 5, windowMs: 60_000 })
    if (limited) return limited

    const supabase = createSupabaseServerClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) {
      return NextResponse.json({ error: auth.error, message: 'Azione non consentita.' }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action === 'anonymize') {
      const { data, error } = await supabase.rpc('anonymize_old_bookings')
      if (error) {
        safeLogError('[api/admin/retention anonymize]', error)
        return NextResponse.json({ error: 'rpc_failed', message: 'Operazione fallita.' }, { status: 400 })
      }
      return NextResponse.json({ success: true, count: data })
    }

    if (action === 'purge_audit') {
      const { data, error } = await supabase.rpc('purge_old_audit_log')
      if (error) {
        safeLogError('[api/admin/retention purge_audit]', error)
        return NextResponse.json({ error: 'rpc_failed', message: 'Operazione fallita.' }, { status: 400 })
      }
      return NextResponse.json({ success: true, count: data })
    }

    return NextResponse.json({ error: 'invalid_action', message: 'Azione sconosciuta.' }, { status: 400 })
  } catch (err) {
    safeLogError('[api/admin/retention] unexpected', err)
    return NextResponse.json({ error: 'unexpected', message: 'Errore del server.' }, { status: 500 })
  }
}
