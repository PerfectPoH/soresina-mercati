import { createSupabaseServerClient } from '@/lib/supabase-server'
import Link from 'next/link'
import AdminEventCard from '@/components/AdminEventCard'
import BookingsPanel from '@/components/BookingsPanel'

// Gli eventi e le prenotazioni cambiano continuamente: disabilita la cache
// altrimenti dopo aver creato/eliminato un evento la pagina resta ferma.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getAdminData() {
  const supabase = createSupabaseServerClient()
  const todayIso = new Date().toISOString().slice(0, 10)
  const [eventsRes, bookingsRes, cancelReqRes] = await Promise.all([
    supabase.from('events').select('*').order('date'),
    supabase
      .from('bookings')
      // BUG-029: incasso reale.
      // BUG-038: filtriamo solo prenotazioni di eventi attivi/futuri.
      // BUG-047: includiamo paid_price (snapshot del prezzo al momento
      // della prenotazione) — la dashboard non deve dipendere dai prezzi
      // live di stalls/events, altrimenti modifiche del prezzo
      // ricalcolano l'incasso storico in modo sbagliato.
      .select('*, paid_price, stalls(label, price), events!inner(title, date, price_per_stall)')
      .eq('status', 'confirmed')
      .gte('events.date', todayIso)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .not('cancellation_requested_at', 'is', null)
      .neq('status', 'cancelled'),
  ])
  // BUG-039: separiamo eventi attivi/futuri da quelli archiviati.
  const allEvents     = eventsRes.data || []
  const activeEvents  = allEvents.filter(e => e.active && e.date >= todayIso)
  const archived      = allEvents.filter(e => !e.active || e.date < todayIso)
  return {
    events:         activeEvents,
    archivedEvents: archived,
    bookings:       bookingsRes.data || [],
    cancelRequests: cancelReqRes.count || 0,
  }
}

// BUG-047: somma il prezzo realmente pagato per ogni booking. Priorita'
// assoluta a `paid_price` (snapshot immutabile salvato al momento della
// prenotazione). Per backward-compat con righe pre-migration 23 cadiamo
// sul calcolo live `stalls.price ?? events.price_per_stall`. Dopo che il
// backfill della migration 23 e' stato eseguito sul DB, tutti i bookings
// dovrebbero avere paid_price valorizzato e il fallback non scatta mai.
function calcolaIncasso(bookings) {
  return bookings.reduce((acc, b) => {
    const price = b.paid_price ?? b.stalls?.price ?? b.events?.price_per_stall ?? 0
    return acc + Number(price)
  }, 0)
}

export default async function AdminPage() {
  const { events, archivedEvents, bookings, cancelRequests } = await getAdminData()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-stone-900">Dashboard</h1>
          <p className="text-stone-400 text-sm mt-0.5">Gestione mercati Pro Loco Soresina</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/cancellazioni"
            className="text-sm px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline relative"
          >
            Cancellazioni
            {cancelRequests > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cancelRequests}
              </span>
            )}
          </Link>
          <Link
            href="/admin/lista-attesa"
            className="text-sm px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline"
          >
            Lista d'attesa
          </Link>
          <Link
            href="/admin/statistiche"
            className="text-sm px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline"
          >
            Statistiche
          </Link>
          <Link
            href="/admin/audit"
            className="text-sm px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline"
          >
            Audit log
          </Link>
          <Link
            href="/admin/privacy"
            className="text-sm px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline"
          >
            Privacy
          </Link>
          <Link
            href="/admin/eventi/nuovo"
            className="text-sm px-4 py-2 rounded-lg text-white font-medium no-underline"
            style={{ background: '#BA7517' }}
          >
            + Nuovo evento
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Eventi attivi',   val: events.filter(e => e.active).length },
          { label: 'Prenotazioni',    val: bookings.length },
          { label: 'Incasso stimato', val: `${calcolaIncasso(bookings)}€` },
          { label: 'Prossimo evento', val: events.find(e => new Date(e.date) >= new Date())?.title?.split(' ').slice(-1)[0] || '—' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="text-xs text-stone-400 mb-1">{k.label}</div>
            <div className="text-xl font-medium text-stone-900">{k.val}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Lista eventi: due sezioni — attivi/futuri e archivio.
            BUG-039: gli eventi passati vengono auto-archiviati dal cron
            DB ogni notte. Qui li mostriamo in una sezione separata
            "<details>" così la dashboard resta pulita ma lo storico
            è accessibile in un click. */}
        <div>
          <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Eventi attivi</h2>
          <div className="space-y-2">
            {events.map(event => (
              <AdminEventCard key={event.id} event={event} />
            ))}
            {events.length === 0 && (
              <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
                <Link href="/admin/eventi/nuovo" className="text-amber-600">Crea il primo evento →</Link>
              </div>
            )}
          </div>

          {archivedEvents.length > 0 && (
            <details className="mt-6 group">
              <summary className="cursor-pointer text-xs font-medium text-stone-500 uppercase tracking-wider hover:text-stone-700">
                Archivio · {archivedEvents.length} {archivedEvents.length === 1 ? 'evento' : 'eventi'}
                <span className="ml-1 text-stone-300 group-open:rotate-90 inline-block transition-transform">▸</span>
              </summary>
              <div className="space-y-2 mt-3 opacity-75">
                {archivedEvents.map(event => (
                  <AdminEventCard key={event.id} event={event} />
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Prenotazioni con ricerca e filtro */}
        <div className="lg:col-span-2">
          <BookingsPanel bookings={bookings} events={events} />
        </div>
      </div>
    </div>
  )
}
