'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Bottone client che invia richiesta di cancellazione a /api/bookings/:id/cancellation-request
// con un motivo opzionale. La cancellazione effettiva (con eventuale rimborso
// Stripe) la decide l'admin.
export default function RequestBookingCancellation({ bookingId }) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [done,    setDone]    = useState(false)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancellation-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || 'Errore nell\'invio della richiesta.')
        return
      }
      setDone(true)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <span className="text-[11px] text-amber-700 italic shrink-0">
        Richiesta inviata
      </span>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-stone-500 hover:text-red-600 underline shrink-0"
      >
        Richiedi cancellazione
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-56 shrink-0 bg-stone-50 border border-stone-200 rounded-lg p-2">
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motivo (facoltativo)"
        rows={2}
        maxLength={500}
        className="text-xs border border-stone-200 rounded px-2 py-1 focus:outline-none focus:border-amber-400 resize-none"
      />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 text-[11px] py-1 border border-stone-200 rounded text-stone-500 hover:bg-stone-100"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="flex-1 text-[11px] py-1 rounded text-white font-medium disabled:opacity-50"
          style={{ background: '#BA7517' }}
        >
          {loading ? 'Invio...' : 'Invia richiesta'}
        </button>
      </div>
      <p className="text-[10px] text-stone-400">
        L'admin valuterà la richiesta e procederà con il rimborso se idoneo.
      </p>
    </div>
  )
}
