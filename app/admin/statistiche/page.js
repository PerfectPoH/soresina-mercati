import { createSupabaseServerClient } from '@/lib/supabase-server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getStats() {
  const supabase = createSupabaseServerClient()

  const [eventsRes, bookingsRes, stallsRes] = await Promise.all([
    supabase.from('events').select('id, title, date'),
    supabase
      .from('bookings')
      .select('id, event_id, user_id, vendor_name, vendor_email, goods_type, created_at, events(date)')
      .eq('status', 'confirmed'),
    supabase.from('stalls').select('id, event_id, blocked'),
  ])

  return {
    events:   eventsRes.data   || [],
    bookings: bookingsRes.data || [],
    stalls:   stallsRes.data   || [],
  }
}

// Helpers di aggregazione
function yearOf(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).getFullYear()
}

function analyzeReturningVendors(bookings) {
  // vendor -> set di anni in cui ha prenotato
  const vendors = new Map()
  for (const b of bookings) {
    const y = yearOf(b.events?.date || b.created_at)
    if (!y) continue
    const key = b.user_id || b.vendor_email || b.vendor_name
    if (!key) continue
    if (!vendors.has(key)) {
      vendors.set(key, { name: b.vendor_name, years: new Set() })
    }
    vendors.get(key).years.add(y)
  }

  const returning = []
  for (const [, v] of vendors) {
    if (v.years.size > 1) {
      returning.push({ name: v.name, yearsCount: v.years.size, years: [...v.years].sort() })
    }
  }
  returning.sort((a, b) => b.yearsCount - a.yearsCount)
  return { totalVendors: vendors.size, returning }
}

function analyzeGoodsTypes(bookings) {
  const counts = new Map()
  for (const b of bookings) {
    const g = b.goods_type || 'Altro'
    counts.set(g, (counts.get(g) || 0) + 1)
  }
  const total = bookings.length || 1
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
}

function analyzeOccupancy(events, bookings, stalls) {
  return events
    .map(ev => {
      const capacity = stalls.filter(s => s.event_id === ev.id).length
      const booked   = bookings.filter(b => b.event_id === ev.id).length
      const pct      = capacity > 0 ? Math.round((booked / capacity) * 100) : 0
      return { id: ev.id, title: ev.title, date: ev.date, capacity, booked, pct }
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

export default async function StatistichePage() {
  const { events, bookings, stalls } = await getStats()

  const { totalVendors, returning } = analyzeReturningVendors(bookings)
  const goods        = analyzeGoodsTypes(bookings)
  const occupancy    = analyzeOccupancy(events, bookings, stalls)
  const topGood      = goods[0]
  const avgOccupancy = occupancy.length
    ? Math.round(occupancy.reduce((s, o) => s + o.pct, 0) / occupancy.length)
    : 0

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/admin" className="hover:text-stone-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-700">Statistiche</span>
      </div>

      <h1 className="text-2xl font-medium text-stone-900 mb-1">Statistiche storiche</h1>
      <p className="text-stone-400 text-sm mb-6">Dati aggregati su tutti gli eventi e le prenotazioni confermate.</p>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Venditori unici',       val: totalVendors },
          { label: 'Prenotazioni totali',   val: bookings.length },
          { label: 'Venditori che tornano', val: returning.length },
          { label: 'Occupazione media',     val: `${avgOccupancy}%` },
        ].map(k => (
          <div key={k.label} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="text-xs text-stone-400 mb-1">{k.label}</div>
            <div className="text-xl font-medium text-stone-900">{k.val}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Merce piu' prenotata */}
        <div>
          <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
            Merce più prenotata
          </h2>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {goods.length === 0 ? (
              <div className="text-center text-stone-400 text-sm p-6">Nessun dato</div>
            ) : (
              goods.map((g, i) => (
                <div
                  key={g.label}
                  className={`flex items-center justify-between px-4 py-3 ${i < goods.length - 1 ? 'border-b border-stone-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-800">{g.label}</div>
                    <div className="w-full h-1.5 mt-1 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${g.pct}%`, background: '#BA7517' }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <div className="text-sm font-medium text-stone-900">{g.count}</div>
                    <div className="text-xs text-stone-400">{g.pct}%</div>
                  </div>
                </div>
              ))
            )}
          </div>
          {topGood && (
            <p className="text-xs text-stone-500 mt-2">
              Categoria più richiesta: <span className="font-medium text-stone-800">{topGood.label}</span>
              {' '}({topGood.count} prenotazioni)
            </p>
          )}
        </div>

        {/* Venditori fedeli */}
        <div>
          <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
            Venditori che tornano ({returning.length})
          </h2>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {returning.length === 0 ? (
              <div className="text-center text-stone-400 text-sm p-6">
                Nessun venditore ha ancora partecipato a piu' di un anno.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Venditore</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase">Anni</th>
                    <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase">Stagioni</th>
                  </tr>
                </thead>
                <tbody>
                  {returning.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-b border-stone-50 last:border-0">
                      <td className="px-4 py-2.5 text-stone-800">{r.name}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-stone-900">{r.yearsCount}</td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-right text-xs text-stone-400">
                        {r.years.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Occupazione per evento */}
      <div className="mt-8">
        <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
          Occupazione per evento
        </h2>
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {occupancy.length === 0 ? (
            <div className="text-center text-stone-400 text-sm p-6">Nessun evento</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Evento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Data</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase">Prenotati</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase">Capienza</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase">Occupazione</th>
                </tr>
              </thead>
              <tbody>
                {occupancy.map((o, i) => (
                  <tr key={o.id} className={i < occupancy.length - 1 ? 'border-b border-stone-50' : ''}>
                    <td className="px-4 py-2.5 text-stone-800">{o.title}</td>
                    <td className="px-4 py-2.5 text-stone-500">
                      {new Date(o.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-800">{o.booked}</td>
                    <td className="px-4 py-2.5 text-right text-stone-500">{o.capacity}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className="inline-block min-w-[45px] text-center text-xs px-2 py-0.5 rounded-full"
                        style={o.pct >= 90
                          ? { background: '#FDECEC', color: '#B71C1C' }
                          : o.pct >= 50
                          ? { background: '#FFF3E0', color: '#BA7517' }
                          : { background: '#EAF3DE', color: '#3B6D11' }}
                      >
                        {o.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
