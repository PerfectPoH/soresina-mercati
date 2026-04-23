import { createSupabaseServerClient } from '@/lib/supabase-server'
import { safeLogError } from '@/lib/log'
import Link from 'next/link'
import AdminWaitlistRow from '@/components/AdminWaitlistRow'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getWaitlist() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('waitlist')
    .select('*, events(title, date)')
    .order('event_id')
    .order('created_at')
  if (error) {
    safeLogError('[admin/lista-attesa] fetch error', error)
    return []
  }
  return data || []
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ListaAttesaPage() {
  const entries = await getWaitlist()

  // Raggruppa per evento mantenendo ordine di created_at (per calcolare la posizione)
  const byEvent = new Map()
  for (const e of entries) {
    const key = e.event_id
    if (!byEvent.has(key)) byEvent.set(key, { event: e.events, rows: [] })
    byEvent.get(key).rows.push(e)
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/admin" className="hover:text-stone-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-700">Lista d'attesa</span>
      </div>

      <h1 className="text-2xl font-medium text-stone-900 mb-1">Liste d'attesa</h1>
      <p className="text-stone-400 text-sm mb-6">
        Venditori iscritti in attesa di un posteggio, ordinati per data di iscrizione.
      </p>

      {byEvent.size === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
          Nessuna iscrizione in lista d'attesa
        </div>
      ) : (
        <div className="space-y-6">
          {[...byEvent.entries()].map(([eventId, group]) => (
            <div key={eventId}>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm font-medium text-stone-800">
                  {group.event?.title || 'Evento'}
                </h2>
                <div className="text-xs text-stone-400">
                  {group.event?.date ? formatDate(group.event.date) : ''}
                  {' · '}
                  {group.rows.length} iscritti
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase w-10">#</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Venditore</th>
                      <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Merce</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Iscritto il</th>
                      <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((entry, i) => (
                      <AdminWaitlistRow
                        key={entry.id}
                        entry={entry}
                        position={i + 1}
                        isLast={i === group.rows.length - 1}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
