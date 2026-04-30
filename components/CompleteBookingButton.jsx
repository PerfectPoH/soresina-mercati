'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// BUG-046: bottone per completare un booking pending (caso tipico:
// promosso dalla waitlist con 24h, oppure pending Stripe scaduto e da
// rilanciare). Per eventi gratuiti conferma immediatamente. Per eventi
// a pagamento apre nuova Stripe Checkout.
export default function CompleteBookingButton({ bookingId, isFree, label }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function handleComplete() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || 'Errore durante il completamento.')
        return
      }
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl
      } else {
        router.refresh()
      }
    } catch (e) {
      setError(e?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleComplete}
        disabled={loading}
        className="text-sm rounded-xl py-3 px-6 text-white font-medium transition-opacity disabled:opacity-50"
        style={{ background: '#BA7517' }}
      >
        {loading
          ? 'Attendere…'
          : (label || (isFree ? 'Conferma prenotazione' : 'Completa il pagamento'))}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
