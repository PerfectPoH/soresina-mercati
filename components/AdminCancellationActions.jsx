'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Bottoni admin per approvare (con o senza rimborso) o rifiutare la richiesta
// di cancellazione di una prenotazione.
export default function AdminCancellationActions({ bookingId, hasPaymentIntent }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function approve(refund) {
    // BUG-045: chiediamo SEMPRE un motivo all'admin. Verra' salvato sul
    // booking e (in futuro con Resend) inviato via email all'utente.
    const reasonPrompt = refund
      ? 'Motivo dell\'annullamento (verrà mostrato all\'utente):'
      : 'Motivo dell\'annullamento SENZA rimborso (verrà mostrato all\'utente):'
    const reason = window.prompt(reasonPrompt, '')
    if (reason === null) return  // user clicked Cancel
    const trimmed = reason.trim()
    if (!trimmed) {
      alert('Devi inserire un motivo prima di procedere.')
      return
    }

    if (!confirm(refund
      ? `Confermi annullamento + rimborso Stripe automatico?\nMotivo: "${trimmed}"`
      : `Confermi annullamento SENZA rimborso?\nMotivo: "${trimmed}"`
    )) return

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refund, reason: trimmed }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || 'Errore')
      router.refresh()
    } catch (e) {
      setError(e?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  async function deny() {
    if (!confirm('Rifiutare la richiesta di cancellazione? La prenotazione resta attiva.')) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/cancel`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || 'Errore')
      router.refresh()
    } catch (e) {
      setError(e?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex gap-1">
        {hasPaymentIntent && (
          <button
            type="button"
            onClick={() => approve(true)}
            disabled={loading}
            className="text-[11px] px-2 py-1 rounded text-white font-medium disabled:opacity-50"
            style={{ background: '#16a34a' }}
          >
            Annulla + rimborsa
          </button>
        )}
        <button
          type="button"
          onClick={() => approve(false)}
          disabled={loading}
          className="text-[11px] px-2 py-1 rounded border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Annulla senza rimborso
        </button>
        <button
          type="button"
          onClick={deny}
          disabled={loading}
          className="text-[11px] px-2 py-1 rounded border border-stone-300 text-stone-500 hover:bg-stone-50 disabled:opacity-50"
        >
          Rifiuta richiesta
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
