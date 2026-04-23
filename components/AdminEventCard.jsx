'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function AdminEventCard({ event }) {
  const router = useRouter()
  const [busy,    setBusy]    = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error,   setError]   = useState(null)

  async function callApi(method, body) {
    setBusy(true)
    setError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`/api/events/${event.id}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || 'Errore.')
        setBusy(false)
        return false
      }
      router.refresh()
      // Busy resta a true: la card viene rimpiazzata dal refresh.
      return true
    } catch (err) {
      console.error('[AdminEventCard] api error', err)
      setError(err?.name === 'AbortError' ? 'Timeout.' : 'Errore di rete.')
      setBusy(false)
      return false
    }
  }

  async function handleDelete()            { await callApi('DELETE') }
  async function handleToggleActive()      { await callApi('PATCH', { active: !event.active }) }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-stone-900 text-sm truncate">{event.title}</div>
          <div className="text-xs text-stone-400 mt-0.5">{formatDate(event.date)}</div>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0"
          style={event.active
            ? { background: '#EAF3DE', color: '#3B6D11' }
            : { background: '#F1EFE8', color: '#5F5E5A' }}
        >
          {event.active ? 'Attivo' : 'Archiviato'}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-stone-400">
        <span>{event.rows * event.cols} posteggi · {event.price_per_stall}€/g</span>
        <Link
          href={`/evento/${event.id}`}
          className="ml-auto text-amber-600 hover:underline"
        >
          Mappa →
        </Link>
      </div>

      {/* Azioni admin */}
      {!confirm ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-stone-100 text-xs">
          <Link
            href={`/admin/eventi/${event.id}/modifica`}
            className="text-amber-700 hover:text-amber-900 hover:underline"
          >
            Modifica
          </Link>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={busy}
            className="text-stone-500 hover:text-stone-800 hover:underline disabled:opacity-50"
          >
            {event.active ? 'Archivia' : 'Ripristina'}
          </button>
          <Link
            href={`/admin/eventi/${event.id}/stampa`}
            className="text-stone-500 hover:text-stone-800 hover:underline"
          >
            Stampa
          </Link>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={busy}
            className="ml-auto text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
          >
            Elimina
          </button>
          {error && <p className="basis-full text-red-600 mt-1">{error}</p>}
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <p className="text-xs text-stone-700 mb-2">
            Eliminare <span className="font-medium">{event.title}</span>?
            Verranno cancellati tutti i posteggi e le prenotazioni collegate.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setConfirm(false); setError(null) }}
              disabled={busy}
              className="flex-1 text-xs border border-stone-200 rounded-md py-1.5 text-stone-500 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="flex-1 text-xs rounded-md py-1.5 bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {busy ? 'Elimino...' : 'Sì, elimina'}
            </button>
          </div>
          {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
        </div>
      )}
    </div>
  )
}
