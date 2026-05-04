import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteAccountButton from '@/components/DeleteAccountButton'
import ProfileBookingCard from '@/components/ProfileBookingCard'
import ProfileStatTile from '@/components/ProfileStatTile'

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
    redirect('/accedi')
  }

  // BUG-032: lista completa delle prenotazioni con dettagli (data, evento,
  // posteggio, prezzo pagato, stato), ordinate dalla più recente.
  // BUG-047: includiamo paid_price (snapshot immutabile del prezzo).
  const [{ data: vendor }, { data: bookings }] = await Promise.all([
    supabase.from('vendors')
      .select('name, email, phone, primary_goods_type, vat_number, role, created_at, consent_at')
      .eq('user_id', session.user.id)
      .maybeSingle(),
    supabase.from('bookings')
      .select(`
        id, status, goods_type, created_at, from_waitlist, waitlist_promoted_at,
        admin_cancel_reason, admin_refunded, admin_cancelled_at, paid_price,
        events ( id, title, date, price_per_stall ),
        stalls ( id, label, price )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }),
  ])

  const list = bookings || []
  const today = new Date().toISOString().slice(0, 10)

  // BUG-043 + BUG-044: classificazione difensiva (priorita' a "passata" e
  // gestione di events null se RLS lo nasconde dopo archive).
  function classify(b) {
    if (b.status === 'cancelled')                            return { key: 'cancelled', label: 'Annullata',         color: 'stone' }
    if (!b.events)                                           return { key: 'unknown',   label: 'Evento rimosso',    color: 'stone' }
    if (b.events.date && b.events.date < today)              return { key: 'past',      label: 'Passata',           color: 'stone' }
    if (b.status === 'pending' && b.from_waitlist)           return { key: 'pending',   label: 'In attesa di pagamento (24h)', color: 'amber' }
    if (b.status === 'pending')                              return { key: 'pending',   label: 'In attesa',         color: 'amber' }
    return                                                          { key: 'active',    label: 'Confermata',        color: 'green' }
  }

  // Bucket per sezioni distinte: "da fare" (pending), "prossime" (active),
  // "storico" (past + cancelled + unknown).
  const enriched = list.map(b => ({ b, cls: classify(b) }))
  const bucketPending  = enriched.filter(x => x.cls.key === 'pending')
  const bucketActive   = enriched.filter(x => x.cls.key === 'active')
  const bucketHistory  = enriched.filter(x => ['past', 'cancelled', 'unknown'].includes(x.cls.key))

  const totalBookings    = list.length
  const confirmedFuture  = bucketActive.length
  const pendingCount     = bucketPending.length
  const nextEvent        = bucketActive
    .map(x => x.b.events)
    .filter(Boolean)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0]

  const displayName = vendor?.name?.split(' ')[0] || 'Venditore'

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb minimo */}
      <div className="flex items-center gap-2 text-xs text-stone-400 mb-6">
        <Link href="/" className="hover:text-stone-600 transition-colors no-underline">Mercati</Link>
        <span aria-hidden="true">/</span>
        <span className="text-stone-700">Il mio profilo</span>
      </div>

      {/* Hero personalizzato — Pentagram-ish: tipografia come decoro */}
      <div className="mb-10">
        <h1
          className="text-4xl sm:text-5xl text-stone-900 mb-2 tracking-tight"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          Ciao, {displayName}.
        </h1>
        <p className="text-stone-500 text-base">
          {pendingCount > 0
            ? `Hai ${pendingCount} ${pendingCount === 1 ? 'prenotazione' : 'prenotazioni'} da completare.`
            : confirmedFuture > 0
              ? `Hai ${confirmedFuture} ${confirmedFuture === 1 ? 'prenotazione attiva' : 'prenotazioni attive'}.`
              : 'Nessuna prenotazione attiva al momento.'}
        </p>
      </div>

      {/* KPI strip — 3-4 numeri grandi */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <ProfileStatTile label="Totali" value={totalBookings} index={0} />
        <ProfileStatTile label="Attive" value={confirmedFuture} accent="green" index={1} />
        <ProfileStatTile label="In attesa" value={pendingCount} accent={pendingCount > 0 ? 'amber' : 'stone'} index={2} />
        <ProfileStatTile
          label="Prossimo"
          value={nextEvent?.title?.split(' ').slice(-1)[0] || '—'}
          hint={nextEvent ? formatDate(nextEvent.date) : undefined}
          index={3}
        />
      </div>

      {/* SEZIONE 1: Da fare ora (pending) — solo se ce ne sono */}
      {bucketPending.length > 0 && (
        <Section
          title="Da fare ora"
          subtitle="Completa o conferma queste prenotazioni prima della scadenza."
          accent="amber"
        >
          <div className="grid gap-3">
            {bucketPending.map(({ b, cls }) => (
              <ProfileBookingCard key={b.id} booking={b} classification={cls} />
            ))}
          </div>
        </Section>
      )}

      {/* SEZIONE 2: Prossime prenotazioni (active) */}
      <Section
        title="Prossime prenotazioni"
        subtitle={
          bucketActive.length === 0
            ? <>Non hai prenotazioni attive. <Link href="/" className="text-amber-700 underline">Vai ai mercati</Link>.</>
            : 'I tuoi posteggi confermati per i prossimi mercati.'
        }
      >
        {bucketActive.length > 0 && (
          <div className="grid gap-3">
            {bucketActive.map(({ b, cls }) => (
              <ProfileBookingCard key={b.id} booking={b} classification={cls} />
            ))}
          </div>
        )}
      </Section>

      {/* SEZIONE 3: Storico — collassabile (default chiuso se >0) */}
      {bucketHistory.length > 0 && (
        <details className="mb-10 group">
          <summary className="cursor-pointer flex items-baseline justify-between gap-2 mb-4 list-none">
            <h2
              className="text-xl text-stone-700 tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
            >
              Storico
              <span className="text-stone-400 text-sm font-sans font-normal ml-2">
                ({bucketHistory.length})
              </span>
            </h2>
            <span className="text-xs text-stone-400 group-open:hidden">Mostra ↓</span>
            <span className="text-xs text-stone-400 hidden group-open:inline">Nascondi ↑</span>
          </summary>
          <div className="grid gap-3">
            {bucketHistory.map(({ b, cls }) => (
              <ProfileBookingCard key={b.id} booking={b} classification={cls} />
            ))}
          </div>
        </details>
      )}

      {/* Account info — sezione discreta sotto */}
      <Section title="Le tue informazioni" subtitle="I dati che usiamo per gestire le prenotazioni.">
        <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
          <Field label="Nome e cognome" value={vendor?.name} />
          <Field label="Email"          value={vendor?.email || session.user.email} />
          <Field label="Telefono"       value={vendor?.phone} />
          <Field label="Tipo di merce"  value={vendor?.primary_goods_type} />
          <Field label="Partita IVA"    value={vendor?.vat_number || '—'} />
          <Field label="Ruolo"          value={vendor?.role === 'admin' ? 'Amministratore' : 'Venditore'} />
          <Field label="Iscritto dal"   value={formatDate(vendor?.created_at)} />
        </div>
      </Section>

      {/* Zona pericolo — separata, sotto, in rosso discreto */}
      <div className="mt-12 bg-red-50/60 border border-red-200/60 rounded-2xl p-6">
        <h2 className="text-sm font-medium text-red-800 mb-1">Cancella il mio account</h2>
        <p className="text-xs text-red-700 mb-4 leading-relaxed">
          Ai sensi dell'articolo 17 del GDPR ("diritto all'oblio") puoi cancellare
          in autonomia tutti i tuoi dati. Verranno rimossi: profilo venditore,
          prenotazioni, iscrizioni alla lista d'attesa e l'account di accesso.
          L'azione e' <strong>definitiva</strong>.
        </p>
        <DeleteAccountButton />
      </div>

      <p className="text-xs text-stone-400 mt-6 leading-relaxed">
        Per qualsiasi richiesta relativa ai tuoi dati personali puoi scrivere a{' '}
        <a className="text-amber-700 underline" href="mailto:privacy@prolocosoresina.it">privacy@prolocosoresina.it</a>.
        Vedi la <Link href="/privacy" className="text-amber-700 underline">privacy policy</Link>.
      </p>
    </div>
  )
}

function Section({ title, subtitle, accent, children }) {
  const accentClass = accent === 'amber' ? 'text-amber-800' : 'text-stone-700'
  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2
          className={`text-xl tracking-tight ${accentClass}`}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          {title}
        </h2>
        {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, value }) {
  return (
    <div className="px-5 py-3 flex items-baseline justify-between gap-4">
      <span className="text-xs text-stone-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-stone-800 text-right break-all">{value || '—'}</span>
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
