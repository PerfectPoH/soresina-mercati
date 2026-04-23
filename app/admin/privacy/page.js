import { createSupabaseServerClient } from '@/lib/supabase-server'
import Link from 'next/link'
import RetentionActions from '@/components/RetentionActions'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getCounters() {
  const supabase = createSupabaseServerClient()

  // Prenotazioni collegate a eventi piu' vecchi di 24 mesi,
  // non ancora anonimizzate.
  const twoYearsAgoIso = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [oldBookingsRes, oldAuditRes, totalVendorsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, events!inner(date)', { count: 'exact', head: true })
      .neq('vendor_name', 'Anonimizzato')
      .lt('events.date', twoYearsAgoIso),
    supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('vendors')
      .select('user_id', { count: 'exact', head: true }),
  ])

  return {
    oldBookings: oldBookingsRes.count || 0,
    oldAudit:    oldAuditRes.count    || 0,
    vendors:     totalVendorsRes.count || 0,
  }
}

export default async function AdminPrivacyPage() {
  const counters = await getCounters()

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/admin" className="hover:text-stone-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-700">Privacy e retention</span>
      </div>

      <h1 className="text-2xl font-medium text-stone-900 mb-1">Privacy e retention dati</h1>
      <p className="text-stone-400 text-sm mb-6">
        Strumenti per applicare la data retention policy GDPR.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Kpi label="Venditori registrati" value={counters.vendors} />
        <Kpi label="Prenotazioni > 24 mesi" value={counters.oldBookings} />
        <Kpi label="Log audit > 90 gg" value={counters.oldAudit} />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-medium text-stone-800 mb-1">Policy attiva</h2>
        <ul className="list-disc pl-5 text-sm text-stone-600 space-y-1">
          <li>
            Prenotazioni di eventi <strong>piu' vecchi di 24 mesi</strong>:
            i dati del venditore (nome, telefono, email, note) vengono
            anonimizzati. Resta solo il dato aggregato (data, tipo di merce,
            posteggio).
          </li>
          <li>
            Audit log: le voci piu' vecchie di <strong>90 giorni</strong>
            vengono cancellate.
          </li>
          <li>
            I venditori possono cancellare in autonomia il proprio account
            dalla pagina <em>Il mio profilo</em> (GDPR Art. 17).
          </li>
        </ul>
        <p className="text-xs text-stone-400 mt-3">
          Gli automatismi sono implementati come funzioni SQL in{' '}
          <code className="text-stone-600">supabase/gdpr-migration.sql</code>.
          Possono essere schedulati con un cron esterno (es. GitHub Action
          mensile che chiama l'RPC), oppure lanciati a mano qui.
        </p>
      </div>

      <RetentionActions
        oldBookings={counters.oldBookings}
        oldAudit={counters.oldAudit}
      />
    </div>
  )
}

function Kpi({ label, value }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-xs text-stone-400 mb-1">{label}</div>
      <div className="text-xl font-medium text-stone-900">{value}</div>
    </div>
  )
}
