import { createSupabaseServerClient } from '@/lib/supabase-server'
import Link from 'next/link'
import AdminCancellationActions from '@/components/AdminCancellationActions'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export const metadata = { title: 'Richieste cancellazione - Admin' }

async function getRequests() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('bookings')
    .select(`
      id, status, vendor_name, vendor_email, vendor_phone, goods_type,
      cancellation_requested_at, cancellation_reason,
      stripe_payment_intent_id, stripe_session_id,
      events ( id, title, date, price_per_stall ),
      stalls ( label, price )
    `)
    .not('cancellation_requested_at', 'is', null)
    .neq('status', 'cancelled')
    .order('cancellation_requested_at', { ascending: false })
  return data || []
}

export default async function AdminCancellationsPage() {
  const requests = await getRequests()

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/admin" className="hover:text-stone-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-700">Richieste cancellazione</span>
      </div>

      <h1 className="text-2xl font-medium text-stone-900 mb-1">Richieste di cancellazione</h1>
      <p className="text-stone-400 text-sm mb-6">
        Prenotazioni per cui il venditore ha chiesto l'annullamento. Decidi se confermare e rimborsare.
      </p>

      {requests.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-500 text-sm">
          Nessuna richiesta in attesa.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => {
            const price = r.stalls?.price ?? r.events?.price_per_stall ?? 0
            const hasPI = Boolean(r.stripe_payment_intent_id)
            return (
              <div key={r.id} className="bg-white border border-stone-200 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-medium text-stone-900">
                      {r.events?.title || '—'} · Posteggio {r.stalls?.label || '—'}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {formatDate(r.events?.date)} · {price}€ · {r.goods_type}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Richiesta {timeAgo(r.cancellation_requested_at)}
                  </span>
                </div>

                <div className="text-xs text-stone-600 mb-3 space-y-0.5">
                  <div><strong>Venditore:</strong> {r.vendor_name} · {r.vendor_phone || '—'} · {r.vendor_email || '—'}</div>
                  {r.cancellation_reason && (
                    <div className="bg-stone-50 border border-stone-100 rounded p-2 mt-2">
                      <span className="text-stone-400 text-[10px] uppercase tracking-wide">Motivo</span>
                      <p className="text-stone-700 mt-0.5">{r.cancellation_reason}</p>
                    </div>
                  )}
                  <div className="text-stone-400 text-[11px] mt-2">
                    {hasPI
                      ? <>Pagamento: <span className="font-mono">{r.stripe_payment_intent_id}</span></>
                      : <>Nessun payment_intent salvato (booking pre-Stripe o gratuita): rimborso non automatico</>}
                  </div>
                </div>

                <div className="flex justify-end">
                  <AdminCancellationActions bookingId={r.id} hasPaymentIntent={hasPI} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatDate(s) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return '—' }
}
function timeAgo(s) {
  if (!s) return ''
  const ms = Date.now() - new Date(s).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min fa`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h fa`
  const d = Math.floor(h / 24)
  return `${d} g fa`
}
