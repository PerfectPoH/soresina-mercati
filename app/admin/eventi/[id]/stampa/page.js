import { createSupabaseServerClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PrintButton from '@/components/PrintButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getEvent(id) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

async function getStalls(eventId) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('stalls_with_status')
    .select('*')
    .eq('event_id', eventId)
    .order('row_idx')
    .order('col_idx')
  if (error) return []
  return data
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function StampaEventoPage({ params }) {
  const event = await getEvent(params.id)
  if (!event) notFound()
  const stalls = await getStalls(event.id)

  const totalCount    = stalls.length
  // 'booked' = confermato, 'pending' = in attesa di conferma.
  // Li conto entrambi come "prenotati" nel report di stampa.
  const bookedCount   = stalls.filter(s => s.stall_status === 'booked' || s.stall_status === 'pending').length
  const blockedCount  = stalls.filter(s => s.stall_status === 'blocked').length
  const freeCount     = stalls.filter(s => s.stall_status === 'free').length

  return (
    <div className="print-root">
      {/* CSS di stampa */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-root { padding: 0 !important; }
          table { page-break-inside: auto; }
          tr    { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          @page { margin: 1.5cm; }
        }
        .print-table th, .print-table td {
          border: 1px solid #d6d3d1;
          padding: 6px 10px;
          text-align: left;
          font-size: 12px;
          vertical-align: top;
        }
        .print-table th {
          background: #f5f5f4;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.05em;
          color: #57534e;
        }
      `}</style>

      {/* Toolbar (no-print) */}
      <div className="no-print flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <Link href="/admin" className="hover:text-stone-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-stone-700">Stampa posteggi</span>
        </div>
        <PrintButton />
      </div>

      {/* Testata */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-stone-900">{event.title}</h1>
        <div className="text-sm text-stone-600 mt-1">
          {formatDate(event.date)} · {event.location}
        </div>
        <div className="text-xs text-stone-500 mt-1">
          Totale posteggi: {totalCount} ·
          Prenotati: {bookedCount} ·
          Bloccati: {blockedCount} ·
          Liberi: {freeCount} ·
          Prezzo: {event.price_per_stall}€/g
        </div>
      </div>

      {/* Tabella */}
      <table className="print-table w-full border-collapse">
        <thead>
          <tr>
            <th style={{ width: '12%' }}>Posto</th>
            <th style={{ width: '28%' }}>Venditore</th>
            <th style={{ width: '18%' }}>Telefono</th>
            <th style={{ width: '20%' }}>Merce</th>
            <th style={{ width: '12%' }}>Stato</th>
            <th style={{ width: '10%' }}>Firma</th>
          </tr>
        </thead>
        <tbody>
          {stalls.map(s => {
            const status = s.stall_status
            const stateLabel = status === 'booked'  ? 'Prenotato'
                             : status === 'pending' ? 'In attesa'
                             : status === 'blocked' ? (s.blocked_reason ? `Bloccato (${s.blocked_reason})` : 'Bloccato')
                             : 'Libero'
            return (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.label}</td>
                <td>{s.vendor_name || '—'}</td>
                <td>{s.vendor_phone || '—'}</td>
                <td>{s.goods_type || '—'}</td>
                <td>{stateLabel}</td>
                <td>&nbsp;</td>
              </tr>
            )
          })}
          {stalls.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: '#a8a29e' }}>
                Nessun posteggio configurato
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="text-xs text-stone-400 mt-6">
        Stampato il {new Date().toLocaleString('it-IT')} — Pro Loco Soresina
      </div>
    </div>
  )
}
