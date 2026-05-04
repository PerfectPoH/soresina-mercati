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
      // BUG-047: includiamo paid_price (snapshot del prezzo) per evitare
      // che modifiche di events.price_per_stall ricalcolino l'incasso storico.
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

// BUG-047: somma il prezzo realmente pagato leggendo dal snapshot.
function calcolaIncasso(bookings) {
  return bookings.reduce((acc, b) => {
    const price = b.paid_price ?? b.stalls?.price ?? b.events?.price_per_stall ?? 0
    return acc + Number(price)
  }, 0)
}

export default async function AdminPage() {
  const { events, archivedEvents, bookings, cancelRequests } = await getAdminData()

  const nextEventTitle = events.find(e => new Date(e.date) >= new Date())?.title?.split(' ').slice(-1)[0] || '—'
  const incasso = calcolaIncasso(bookings)

  // Sezione "da gestire": cancellazioni pending sono ad altissima priorita',
  // vanno mostrate in cima con badge contatore visibile (Pentagram principle:
  // information hierarchy = visual hierarchy).
  const hasUrgent = cancelRequests > 0

  return (
    <div>
      {/* Header Pentagram-style: tipografia disciplinata, nav nel sub-header */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1
              className="text-3xl sm:text-4xl text-stone-900 tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
            >
              Dashboard
            </h1>
            <p className="text-stone-400 text-sm mt-1 uppercase tracking-wider text-[11px]">
              Gestione mercati · Pro Loco Soresina
            </p>
          </div>
          <Link
            href="/admin/eventi/nuovo"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto px-4 py-2 rounded-lg text-white font-medium text-sm no-underline"
            style={{ background: '#BA7517' }}
          >
            <span aria-hidden="true">+</span>
            Nuovo evento
          </Link>
        </div>

        {/* Nav link: orizzontale, divider sottile invece di pill */}
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm border-b border-stone-200 pb-3" aria-label="Sezioni admin">
          <Link
            href="/admin/cancellazioni"
            className={`flex items-center gap-1.5 transition-colors no-underline ${
              hasUrgent ? 'text-red-700 font-medium' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Cancellazioni
            {cancelRequests > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-px tabular-nums">
                {cancelRequests}
              </span>
            )}
          </Link>
          <Link href="/admin/lista-attesa" className="text-stone-500 hover:text-stone-900 transition-colors no-underline">Lista d&apos;attesa</Link>
          <Link href="/admin/statistiche" className="text-stone-500 hover:text-stone-900 transition-colors no-underline">Statistiche</Link>
          <Link href="/admin/audit" className="text-stone-500 hover:text-stone-900 transition-colors no-underline">Audit log</Link>
          <Link href="/admin/privacy" className="text-stone-500 hover:text-stone-900 transition-colors no-underline">Privacy</Link>
        </nav>
      </header>

      {/* Banner urgente: cancellazioni in pending sopra ogni altra cosa */}
      {hasUrgent && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/60 p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-red-900">
              {cancelRequests === 1
                ? '1 richiesta di cancellazione da gestire'
                : `${cancelRequests} richieste di cancellazione da gestire`}
            </div>
            <div className="text-xs text-red-700/80 mt-0.5">
              Approva con o senza rimborso, oppure rifiuta.
            </div>
          </div>
          <Link
            href="/admin/cancellazioni"
            className="text-sm font-medium text-red-900 underline whitespace-nowrap no-underline hover:text-red-700"
          >
            Gestisci →
          </Link>
        </div>
      )}

      {/* KPI strip Linear-style: numeri grandi tabular, label uppercase mini */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200 border border-stone-200 rounded-2xl overflow-hidden mb-8">
        <KpiTile label="Eventi attivi" value={events.filter(e => e.active).length} />
        <KpiTile label="Prenotazioni" value={bookings.length} />
        <KpiTile label="Incasso stimato" value={`${incasso}€`} accent />
        <KpiTile label="Prossimo evento" value={nextEventTitle} small />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Lista eventi: attivi + archivio collassabile (BUG-039) */}
        <div>
          <h2 className="text-[10px] font-medium text-stone-500 uppercase tracking-wider mb-3">
            Eventi attivi
            <span className="ml-1 text-stone-400 font-normal normal-case tracking-normal">
              ({events.length})
            </span>
          </h2>
          <div className="space-y-2">
            {events.map(event => (
              <AdminEventCard key={event.id} event={event} />
            ))}
            {events.length === 0 && (
              <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
                <Link href="/admin/eventi/nuovo" className="text-amber-600 hover:text-amber-700 no-underline">
                  Crea il primo evento →
                </Link>
              </div>
            )}
          </div>

          {archivedEvents.length > 0 && (
            <details className="mt-6 group">
              <summary className="cursor-pointer text-[10px] font-medium text-stone-500 uppercase tracking-wider hover:text-stone-700 list-none flex items-center gap-1">
                <span className="text-stone-300 group-open:rotate-90 inline-block transition-transform">▸</span>
                Archivio · {archivedEvents.length} {archivedEvents.length === 1 ? 'evento' : 'eventi'}
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

function KpiTile({ label, value, accent, small }) {
  return (
    <div className="bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-stone-400 font-medium mb-1.5">{label}</div>
      <div
        className={`tabular-nums tracking-tight ${accent ? 'text-amber-700' : 'text-stone-900'} ${small ? 'text-lg sm:text-xl truncate' : 'text-2xl sm:text-3xl'}`}
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
      >
        {value}
      </div>
    </div>
  )
}
