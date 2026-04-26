'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Spinner from './Spinner'
// BUG-023: import GOODS_TYPES da lib/validate.js (unica fonte di verita'
// backend+frontend). Prima era duplicato qui e in app/registrati/page.js.
import { GOODS_TYPES } from '@/lib/validate'

export default function BookingForm({
  stall,
  event,
  currentUser,
  currentVendor,
  onBooked,
  onConflict,
  onCancel,
}) {
  const router = useRouter()
  // Lo stato di autenticazione arriva gia' calcolato dal server (pagina evento),
  // cosi' evitiamo il problema dei cookie httpOnly non leggibili dal client.
  const user   = currentUser   || null
  const vendor = currentVendor || null

  const [goodsType, setGoodsType] = useState(vendor?.primary_goods_type || GOODS_TYPES[0])
  const [notes,     setNotes]     = useState('')
  const [consent,   setConsent]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [success,   setSuccess]   = useState(false)

  const price = stall.price ?? event.price_per_stall

  // Se non loggato: invita a login/registrazione
  if (!user) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
          <div>
            <div className="font-medium text-stone-900">Posteggio {stall.label}</div>
            <div className="text-xs text-stone-400 mt-0.5">Fila {stall.label[0]}</div>
          </div>
          <div className="text-right">
            <div className="font-medium text-amber-700">{price}€</div>
            <div className="text-xs text-stone-400">al giorno</div>
          </div>
        </div>

        <div className="text-center py-3">
          <div className="text-3xl mb-2">🔒</div>
          <p className="text-sm text-stone-700 font-medium">Accedi per prenotare</p>
          <p className="text-xs text-stone-400 mt-1">Serve un account venditore (gratuito).</p>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <Link
            href="/accedi"
            className="w-full text-center text-sm rounded-lg py-2 text-white font-medium no-underline"
            style={{ background: '#BA7517' }}
          >
            Accedi
          </Link>
          <Link
            href="/registrati"
            className="w-full text-center text-sm rounded-lg py-2 border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline"
          >
            Registrati
          </Link>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-xs text-stone-400 hover:text-stone-600 mt-1"
          >
            Annulla
          </button>
        </div>
      </div>
    )
  }

  // Loggato ma senza riga in vendors (caso limite)
  if (!vendor) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="text-sm text-stone-700 text-center">
          <p className="font-medium mb-1">Profilo venditore incompleto</p>
          <p className="text-xs text-stone-400 mb-4">
            Vai su <Link href="/accedi" className="text-amber-700 underline">Accedi</Link> per completare il profilo.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-sm border border-stone-200 rounded-lg py-2 text-stone-500 hover:bg-stone-50 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!consent) {
      setError('Devi accettare il trattamento dei dati per proseguire.')
      return
    }
    setLoading(true)
    setError(null)

    let payload = null
    let errCode = null
    let errMsg  = null
    let checkoutUrl = null

    try {
      // Timeout di sicurezza a 15s cosi' la UI non resta mai appesa
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stall_id:   stall.id,
          event_id:   event.id,
          goods_type: goodsType,
          notes:      notes.trim(),
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        errCode = json.error
        errMsg  = json.message
      } else {
        payload = json.data
        checkoutUrl = json.checkoutUrl
      }
    } catch (e) {
      console.error('[BookingForm] fetch error', e)
      errCode = 'network'
      errMsg  = e?.message || 'Errore di rete'
    } finally {
      setLoading(false)
    }

    if (errCode) {
      if (errCode === '23505') {
        if (onConflict) onConflict(stall)
        setError('Questo posteggio è stato appena prenotato da un altro venditore. La mappa è stata aggiornata — scegline un altro.')
        return
      }
      if (
        errCode === 'P0001' ||
        (errMsg && errMsg.toLowerCase().includes('limite di 2 posteggi'))
      ) {
        setError('Hai già prenotato 2 posteggi per questo evento: non puoi prenotarne altri.')
        return
      }
      if (errCode === 'not_authenticated') {
        setError('La tua sessione è scaduta. Ricarica la pagina e accedi di nuovo.')
        return
      }
      setError(errMsg || 'Errore durante la prenotazione. Riprova.')
      return
    }

    // Aggiorna lo stato locale della mappa (il posteggio diventa "busy")
    // anche se subito dopo navighiamo via: se l'utente torna indietro con
    // il back button, la mappa mostrera' lo stato corretto.
    if (onBooked) onBooked(payload)
    setSuccess(true)
    // Redirect alla pagina di conferma dedicata (bookmarkable, con .ics,
    // dettagli completi, istruzioni).
    if (payload?.id) {
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        router.push(`/prenotato/${payload.id}`)
      }
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center" role="status" aria-live="polite">
        <div className="flex items-center justify-center gap-2 text-green-700 mb-2">
          <Spinner size={18} />
          <span className="text-sm font-medium">Prenotazione confermata</span>
        </div>
        <p className="text-green-600 text-xs">Apertura conferma...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      {/* Header posteggio */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
        <div>
          <div className="font-medium text-stone-900">Posteggio {stall.label}</div>
          <div className="text-xs text-stone-400 mt-0.5">Fila {stall.label[0]}</div>
        </div>
        <div className="text-right">
          <div className="font-medium text-amber-700">{price}€</div>
          <div className="text-xs text-stone-400">al giorno</div>
        </div>
      </div>

      {/* Dati venditore dal profilo */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 mb-3 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-stone-800">{vendor.name}</div>
            <div className="text-stone-400">{vendor.phone} · {vendor.email}</div>
          </div>
          <span className="text-[10px] text-stone-400 uppercase tracking-wide">Profilo</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Tipo di merce per questo posteggio</label>
          <select
            value={goodsType}
            onChange={e => setGoodsType(e.target.value)}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 bg-white"
          >
            {GOODS_TYPES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-stone-500 mb-1">Note (opzionale)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Es. ho bisogno di corrente elettrica"
            rows={2}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 resize-none"
          />
        </div>

        {/* Consenso GDPR: esplicito, non pre-spuntato */}
        <label className="flex items-start gap-2 text-xs text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            className="mt-0.5 accent-amber-600"
            required
          />
          <span>
            Ho letto la{' '}
            <Link href="/privacy" className="text-amber-700 underline" target="_blank">privacy policy</Link>
            {' '}e accetto il trattamento dei miei dati per la gestione della prenotazione.
          </span>
        </label>

        {error && (
          <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-sm border border-stone-200 rounded-lg py-2 text-stone-500 hover:bg-stone-50 transition-colors"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading || !consent}
            className="flex-1 text-sm rounded-lg py-2 text-white font-medium transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
            style={{ background: '#BA7517' }}
            aria-busy={loading}
          >
            {loading && <Spinner size={14} />}
            {loading ? 'Salvo...' : 'Prenota'}
          </button>
        </div>
      </form>
    </div>
  )
}
