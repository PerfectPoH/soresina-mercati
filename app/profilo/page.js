import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteAccountButton from '@/components/DeleteAccountButton'
import RequestBookingCancellation from '@/components/RequestBookingCancellation'
import CompleteBookingButton from '@/components/CompleteBookingButton'

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
  const [{ data: vendor }, { data: bookings }] = await Promise.all([
    supabase.from('vendors')
      .select('name, email, phone, primary_goods_type, vat_number, role, created_at, consent_at')
      .eq('user_id', session.user.id)
      .maybeSingle(),
    supabase.from('bookings')
      .select(`
        id, status, goods_type, created_at, from_waitlist, waitlist_promoted_at,
        admin_cancel_reason, admin_refunded, admin_cancelled_at,
        events ( id, title, date, price_per_stall ),
        stalls ( id, label, price )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }),
  ])

  const list = bookings || []
  const totalBookings     = list.length
  const confirmedBookings = list.filter(b => b.status === 'confirmed').length

  const today = new Date().toISOString().slice(0, 10)
  // BUG-043: la classificazione "passata" ha priorita' su tutti gli altri
  // stati: se l'evento si e' gia' svolto, non ha senso mostrare "in attesa"
  // o offrire la cancellazione. Senza questa priorita', i pending creati
  // (es. da promote_next_waitlist) su eventi appena scaduti restavano
  // mostrati come "In attesa" con bottone cancellazione cliccabile.
  // BUG-044: se `events` e' null nel join (evento eliminato/archiviato +
  // RLS che lo nasconde), trattiamo come 'unknown' / 'past' per non
  // mostrare placeholder "Evento" senza dati con bottone attivo.
  function classify(b) {
    if (b.status === 'cancelled')                            return { key: 'cancelled', label: 'Annullata',         color: 'stone' }
    if (!b.events)                                           return { key: 'unknown',   label: 'Evento rimosso',    color: 'stone' }
    if (b.events.date && b.events.date < today)              return { key: 'past',      label: 'Passata',           color: 'stone' }
    if (b.status === 'pending' && b.from_waitlist)           return { key: 'pending',   label: 'In attesa (24h)',   color: 'amber' }
    if (b.status === 'pending')                              return { key: 'pending',   label: 'In attesa',         color: 'amber' }
    return                                                          { key: 'active',    label: 'Attiva',            color: 'green' }
  }

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-stone-800">Le mie prenotazioni</h2>
          <div className="flex gap-2 text-xs">
            <span className="text-stone-500">Totali: <strong>{totalBookings}</strong></span>
            <span className="text-stone-500">Confermate: <strong>{confirmedBookings}</strong></span>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-stone-500 italic py-2">
            Non hai ancora prenotato nessun posteggio.{' '}
            <Link href="/" className="text-amber-700 underline">Vai ai mercati</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map(b => {
              const cls = classify(b)
              const price = b.stalls?.price ?? b.events?.price_per_stall ?? 0
              // BUG-043: cancellazione richiedibile solo per prenotazioni
              // attive o pending su eventi futuri. Niente bottone su:
              // - 'past' (l'evento si e' gia' svolto)
              // - 'cancelled' (gia' annullata)
              // - 'unknown' (evento rimosso, niente da cancellare lato user)
              const canRequestCancel = cls.key === 'active' || cls.key === 'pending'
              const title = b.events?.title || (cls.key === 'unknown' ? 'Evento rimosso' : 'Evento')
              return (
                <li key={b.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/prenotato/${b.id}`}
                        className="text-sm font-medium text-stone-900 hover:text-amber-700 truncate"
                      >
                        {title}
                      </Link>
                      <Badge color={cls.color} label={cls.label} />
                    </div>
                    <div className="text-xs text-stone-500 space-y-0.5">
                      <div>📅 {b.events?.date ? formatDate(b.events.date) : '—'}</div>
                      <div>📍 Posteggio <span className="font-mono">{b.stalls?.label || '—'}</span> · {b.goods_type}</div>
                      <div>💶 {price}€</div>
                    </div>
                    {/* BUG-045: motivo annullamento admin (con eventuale rimborso) */}
                    {b.admin_cancel_reason && (
                      <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
                        <div className="font-medium text-stone-700 mb-0.5">
                          Annullata dall'organizzazione
                          {b.admin_refunded ? ' · rimborso emesso' : ' · senza rimborso'}
                        </div>
                        <div className="text-stone-600">Motivo: <span className="italic">"{b.admin_cancel_reason}"</span></div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* BUG-046: per i pending mostriamo "Completa pagamento"/"Conferma" */}
                    {cls.key === 'pending' && (
                      <CompleteBookingButton bookingId={b.id} isFree={Number(price) === 0} />
                    )}
                    {canRequestCancel && cls.key !== 'pending' && (
                      <RequestBookingCancellation bookingId={b.id} />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
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

function Badge({ color, label }) {
  const map = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    stone: 'bg-stone-100 text-stone-600',
  }
  return (
    <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${map[color] || map.stone}`}>
      {label}
    </span>
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
