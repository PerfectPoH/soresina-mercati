import { createSupabaseServerClient } from '@/lib/supabase-server'
import { safeLogError } from '@/lib/log'
import Link from 'next/link'
import AuditLogTable from '@/components/AuditLogTable'

// Il log e' scritto in continuazione dai trigger: niente cache.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const TABLE_FILTER = ['events', 'stalls', 'bookings']

async function getAuditEntries({ table, userId }) {
  const supabase = createSupabaseServerClient()
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (table && TABLE_FILTER.includes(table)) {
    query = query.eq('table_name', table)
  }
  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query
  if (error) {
    safeLogError('[admin/audit] fetch error', error)
    return []
  }
  return data || []
}

export default async function AuditPage({ searchParams }) {
  const table  = searchParams?.table || ''
  const userId = searchParams?.user  || ''

  const entries = await getAuditEntries({ table, userId })

  // Lista utenti unici nelle voci recuperate, per il filtro rapido.
  const users = new Map()
  for (const e of entries) {
    if (e.user_id && !users.has(e.user_id)) {
      users.set(e.user_id, e.user_email || e.user_id.slice(0, 8))
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/admin" className="hover:text-stone-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-700">Audit log</span>
      </div>

      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-medium text-stone-900">Audit log</h1>
        <div className="text-xs text-stone-400">
          Ultime {entries.length} azioni
        </div>
      </div>
      <p className="text-stone-400 text-sm mb-6">
        Ogni modifica a eventi, posteggi e prenotazioni viene registrata automaticamente.
      </p>

      {/* Filtri */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Tabella</label>
            <select
              name="table"
              defaultValue={table}
              className="text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 bg-white"
            >
              <option value="">Tutte</option>
              <option value="events">events</option>
              <option value="stalls">stalls</option>
              <option value="bookings">bookings</option>
            </select>
          </div>
          <div className="min-w-[220px]">
            <label className="block text-xs text-stone-500 mb-1">Utente</label>
            <select
              name="user"
              defaultValue={userId}
              className="text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 bg-white w-full"
            >
              <option value="">Tutti</option>
              {[...users.entries()].map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="text-sm px-4 py-2 rounded-lg text-white font-medium"
              style={{ background: '#BA7517' }}
            >
              Filtra
            </button>
            {(table || userId) && (
              <Link
                href="/admin/audit"
                className="text-sm px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline"
              >
                Reset
              </Link>
            )}
          </div>
        </form>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
          Nessuna azione registrata
        </div>
      ) : (
        <AuditLogTable entries={entries} />
      )}
    </div>
  )
}
