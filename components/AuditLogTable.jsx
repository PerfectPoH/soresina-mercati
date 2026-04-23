'use client'

import { Fragment, useState } from 'react'

// Colori e label dei tipi di azione
const ACTION_STYLES = {
  INSERT: { label: 'Creato',     bg: 'bg-green-100',  fg: 'text-green-700' },
  UPDATE: { label: 'Modificato', bg: 'bg-amber-100',  fg: 'text-amber-700' },
  DELETE: { label: 'Eliminato',  bg: 'bg-red-100',    fg: 'text-red-700'   },
}

const TABLE_LABELS = {
  events:   'Evento',
  stalls:   'Posteggio',
  bookings: 'Prenotazione',
}

function formatDateTime(dateStr) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('it-IT', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// Estrae un riassunto umano del diff, evitando il dump completo di JSON.
// Per INSERT mostriamo alcuni campi chiave; per UPDATE mostriamo solo
// i campi cambiati; per DELETE mostriamo l'identificatore/titolo del record.
function summarizeChanges(action, changes) {
  if (!changes) return null
  if (action === 'INSERT') {
    const row = changes.new || {}
    return pickSummaryFields(row)
  }
  if (action === 'DELETE') {
    const row = changes.old || {}
    return pickSummaryFields(row)
  }
  if (action === 'UPDATE') {
    const oldRow = changes.old || {}
    const newRow = changes.new || {}
    const diffs  = []
    for (const k of Object.keys(newRow)) {
      if (k === 'updated_at' || k === 'created_at') continue
      const a = oldRow[k]
      const b = newRow[k]
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        diffs.push({ field: k, from: a, to: b })
      }
    }
    return diffs
  }
  return null
}

function pickSummaryFields(row) {
  const keys = ['title', 'date', 'label', 'status', 'vendor_name', 'blocked']
  const out  = []
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
      out.push({ field: k, value: row[k] })
    }
  }
  return out
}

function formatValue(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'sì' : 'no'
  if (typeof v === 'object') return JSON.stringify(v)
  const str = String(v)
  return str.length > 60 ? str.slice(0, 60) + '…' : str
}

export default function AuditLogTable({ entries }) {
  const [openId, setOpenId] = useState(null)

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100">
            <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Quando</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Utente</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Tabella</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Azione</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Dettagli</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const style   = ACTION_STYLES[entry.action] || ACTION_STYLES.UPDATE
            const summary = summarizeChanges(entry.action, entry.changes)
            const isOpen  = openId === entry.id
            const isLast  = idx === entries.length - 1
            return (
              <Fragment key={entry.id}>
                <tr
                  className={`${isLast && !isOpen ? '' : 'border-b border-stone-100'} hover:bg-stone-50 cursor-pointer`}
                  onClick={() => setOpenId(isOpen ? null : entry.id)}
                >
                  <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 text-stone-700 truncate max-w-[200px]">
                    {entry.user_email || (entry.user_id ? entry.user_id.slice(0, 8) : '—')}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {TABLE_LABELS[entry.table_name] || entry.table_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.fg}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {Array.isArray(summary) && summary.length > 0 ? (
                      entry.action === 'UPDATE' ? (
                        <span>
                          {summary.slice(0, 2).map(d => d.field).join(', ')}
                          {summary.length > 2 && ` +${summary.length - 2}`}
                        </span>
                      ) : (
                        <span>
                          {summary.slice(0, 2).map(d => `${d.field}: ${formatValue(d.value)}`).join(' · ')}
                        </span>
                      )
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                    <span className="ml-2 text-stone-300">{isOpen ? '▲' : '▼'}</span>
                  </td>
                </tr>
                {isOpen && (
                  <tr className={isLast ? '' : 'border-b border-stone-100'}>
                    <td colSpan={5} className="bg-stone-50 px-4 py-3">
                      <DetailsPanel entry={entry} summary={summary} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DetailsPanel({ entry, summary }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-stone-400">
        <span className="font-medium text-stone-500">ID record:</span>{' '}
        <code className="text-stone-600">{entry.row_id || '—'}</code>
      </div>

      {entry.action === 'UPDATE' ? (
        summary && summary.length > 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="text-left px-3 py-2 font-medium text-stone-500">Campo</th>
                  <th className="text-left px-3 py-2 font-medium text-stone-500">Da</th>
                  <th className="text-left px-3 py-2 font-medium text-stone-500">A</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((d, i) => (
                  <tr key={d.field} className={i === summary.length - 1 ? '' : 'border-b border-stone-100'}>
                    <td className="px-3 py-2 font-medium text-stone-700">{d.field}</td>
                    <td className="px-3 py-2 text-red-700">{formatValue(d.from)}</td>
                    <td className="px-3 py-2 text-green-700">{formatValue(d.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-stone-400">Nessun campo modificato rilevato.</div>
        )
      ) : summary && summary.length > 0 ? (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left px-3 py-2 font-medium text-stone-500">Campo</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Valore</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((d, i) => (
                <tr key={d.field} className={i === summary.length - 1 ? '' : 'border-b border-stone-100'}>
                  <td className="px-3 py-2 font-medium text-stone-700">{d.field}</td>
                  <td className="px-3 py-2 text-stone-600">{formatValue(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs text-stone-400">Nessun riepilogo disponibile.</div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-stone-500 hover:text-stone-700">
          JSON completo
        </summary>
        <pre className="mt-2 bg-stone-900 text-stone-100 p-3 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
{JSON.stringify(entry.changes, null, 2)}
        </pre>
      </details>
    </div>
  )
}
