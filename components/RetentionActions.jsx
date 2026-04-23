'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RetentionActions({ oldBookings, oldAudit }) {
  const router = useRouter()
  const [running, setRunning] = useState(null)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  async function run(action, label) {
    const sure = window.confirm(`Confermi di voler eseguire "${label}"? L'azione e' irreversibile.`)
    if (!sure) return
    setError(null)
    setResult(null)
    setRunning(action)
    try {
      const res = await fetch('/api/admin/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || 'Operazione fallita.')
      } else {
        setResult({ action, count: json.count ?? 0 })
        router.refresh()
      }
    } catch (_) {
      setError('Errore di rete.')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-medium text-stone-800">Esegui ora</h2>

      <div className="flex items-center justify-between gap-3 flex-wrap border border-stone-100 rounded-lg px-3 py-3">
        <div>
          <div className="text-sm text-stone-800">Anonimizza prenotazioni vecchie</div>
          <div className="text-xs text-stone-400">
            {oldBookings} prenotazioni candidate (eventi piu' vecchi di 24 mesi)
          </div>
        </div>
        <button
          type="button"
          onClick={() => run('anonymize', 'Anonimizza prenotazioni vecchie')}
          disabled={running !== null || oldBookings === 0}
          className="text-sm px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          {running === 'anonymize' ? 'Esecuzione...' : 'Anonimizza'}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap border border-stone-100 rounded-lg px-3 py-3">
        <div>
          <div className="text-sm text-stone-800">Purga audit log vecchio</div>
          <div className="text-xs text-stone-400">
            {oldAudit} voci candidate (piu' vecchie di 90 giorni)
          </div>
        </div>
        <button
          type="button"
          onClick={() => run('purge_audit', 'Purga audit log vecchio')}
          disabled={running !== null || oldAudit === 0}
          className="text-sm px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          {running === 'purge_audit' ? 'Esecuzione...' : 'Purga'}
        </button>
      </div>

      {result && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Operazione completata: {result.count} record trattati.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
