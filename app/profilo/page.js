import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteAccountButton from '@/components/DeleteAccountButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export const metadata = {
  title: 'Il mio profilo - Mercati Soresina',
}

export default async function ProfiloPage() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    // Redirect a login con ritorno dopo autenticazione
    redirect('/accedi')
  }

  const [{ data: vendor }, { data: bookingsAgg }] = await Promise.all([
    supabase.from('vendors')
      .select('name, email, phone, primary_goods_type, vat_number, role, created_at, consent_at')
      .eq('user_id', session.user.id)
      .maybeSingle(),
    supabase.from('bookings')
      .select('id, status')
      .eq('user_id', session.user.id),
  ])

  const totalBookings     = bookingsAgg?.length || 0
  const confirmedBookings = bookingsAgg?.filter(b => b.status === 'confirmed').length || 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/" className="hover:text-stone-600 transition-colors">Mercati</Link>
        <span>/</span>
        <span className="text-stone-700">Il mio profilo</span>
      </div>

      <h1 className="text-2xl font-medium text-stone-900 mb-1">Il mio profilo</h1>
      <p className="text-stone-400 text-sm mb-6">
        Le informazioni che usiamo per gestire le tue prenotazioni.
      </p>

      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4 mb-6">
        <Field label="Nome e cognome" value={vendor?.name} />
        <Field label="Email"          value={vendor?.email || session.user.email} />
        <Field label="Telefono"       value={vendor?.phone} />
        <Field label="Tipo di merce"  value={vendor?.primary_goods_type} />
        <Field label="Partita IVA"    value={vendor?.vat_number || '—'} />
        <Field label="Ruolo"          value={vendor?.role === 'admin' ? 'Amministratore' : 'Venditore'} />
        <Field label="Iscritto dal"   value={formatDate(vendor?.created_at)} />
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-medium text-stone-800 mb-3">Le mie prenotazioni</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Totali"      value={totalBookings} />
          <Stat label="Confermate"  value={confirmedBookings} />
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <h2 className="text-sm font-medium text-red-800 mb-1">Cancella il mio account</h2>
        <p className="text-xs text-red-700 mb-4">
          Ai sensi dell'articolo 17 del GDPR ("diritto all'oblio") puoi cancellare
          in autonomia tutti i tuoi dati. Verranno rimossi: profilo venditore,
          prenotazioni, iscrizioni alla lista d'attesa e l'account di accesso.
          L'azione e' <strong>definitiva</strong>.
        </p>
        <DeleteAccountButton />
      </div>

      <p className="text-xs text-stone-400 mt-4">
        Per qualsiasi richiesta relativa ai tuoi dati personali puoi scrivere a{' '}
        <a className="text-amber-700 underline" href="mailto:privacy@prolocosoresina.it">privacy@prolocosoresina.it</a>.
        Vedi la <Link href="/privacy" className="text-amber-700 underline">privacy policy</Link>.
      </p>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-xs text-stone-500">{label}</span>
      <span className="text-sm text-stone-800 text-right break-all">{value || '—'}</span>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-stone-50 rounded-lg p-3">
      <div className="text-xs text-stone-400">{label}</div>
      <div className="text-xl font-medium text-stone-900">{value}</div>
    </div>
  )
}

function formatDate(s) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}
