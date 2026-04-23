'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const GOODS_TYPES = [
  'Abbigliamento',
  'Alimentari',
  'Artigianato',
  'Fiori e piante',
  'Casalinghi',
  'Giocattoli',
  'Elettronica',
  'Altro',
]

// Widget che appare nella pagina evento quando non ci sono piu' posti liberi.
// Consente al venditore di iscriversi alla lista d'attesa.
export default function WaitlistWidget({
  event,
  currentUser,
  currentVendor,
  currentEntry,        // iscrizione gia' presente per questo utente (o null)
  position,            // posizione in lista (1-based) se iscritto
  totalEntries,        // totale iscritti in lista
}) {
  const router = useRouter()
  const [goodsType, setGoodsType] = useState(currentVendor?.primary_goods_type || GOODS_TYPES[0])
  const [notes,     setNotes]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [done,      setDone]      = useState(false)

  // Non loggato
  if (!currentUser) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm">
        <div className="font-medium text-amber-900 mb-1">Evento al completo</div>
        <p className="text-amber-800 mb-3">
          Tutti i posteggi sono stati prenotati.
          <Link href="/accedi" className="underline ml-1">Accedi</Link> per iscriverti alla lista d'attesa.
        </p>
      </div>
    )
  }

  // Profilo venditore mancante
  if (!currentVendor) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm">
        <div className="font-medium text-amber-900 mb-1">Evento al completo</div>
        <p className="text-amber-800">
          Completa il profilo venditore per iscriverti alla lista d'attesa.
        </p>
      </div>
    )
  }

  // Gia' iscritto
  if (currentEntry) {
    async function handleRemove() {
      if (!window.confirm('Rimuovere la tua iscrizione dalla lista d\'attesa?')) return
      setLoading(true)
      try {
        const res = await fetch(`/api/waitlist/${currentEntry.id}`, { method: 'DELETE' })
        if (res.ok) router.refresh()
        else {
          const json = await res.json().catch(() => ({}))
          setError(json.message || 'Errore.')
        }
      } catch (err) {
        setError('Errore di rete.')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm">
        <div className="font-medium text-amber-900 mb-1">
          Sei in lista d'attesa
          {position ? ` (posizione #${position}${totalEntries ? ` di ${totalEntries}` : ''})` : ''}
        </div>
        <p className="text-amber-800 mb-3">
          Ti avviseremo se si libera un posteggio.
        </p>
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading}
          className="text-xs text-amber-800 underline hover:text-amber-900 disabled:opacity-50"
        >
          {loading ? '...' : 'Rimuovi iscrizione'}
        </button>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>
    )
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-sm text-center">
        <div className="text-2xl mb-1">✓</div>
        <div className="font-medium text-green-800">Iscritto alla lista d'attesa</div>
        <div className="text-xs text-green-700 mt-1">Ti avviseremo se si libera un posteggio.</div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const controller = new AbortController()
      const timeoutId  = setTimeout(() => controller.abort(), 15000)
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          goods_type: goodsType,
          notes: notes.trim(),
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (json.error === '23505') setError('Sei gia\' iscritto alla lista d\'attesa di questo evento.')
        else setError(json.message || 'Errore.')
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => router.refresh(), 800)
    } catch (err) {
      console.error('[WaitlistWidget] fetch error', err)
      setError(err?.name === 'AbortError' ? 'Timeout.' : 'Errore di rete.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm space-y-3">
      <div>
        <div className="font-medium text-amber-900">Evento al completo</div>
        <p className="text-amber-800 text-xs mt-1">
          Iscriviti alla lista d'attesa: se si libera un posteggio
          ti contatteremo ai recapiti del tuo profilo.
        </p>
      </div>

      <div>
        <label className="block text-xs text-amber-900 mb-1">Tipo di merce</label>
        <select
          value={goodsType}
          onChange={e => setGoodsType(e.target.value)}
          className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white"
        >
          {GOODS_TYPES.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs text-amber-900 mb-1">Note (opzionale)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Es. disponibile solo la mattina"
          className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white resize-none"
        />
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full text-sm rounded-lg py-2 text-white font-medium disabled:opacity-50"
        style={{ background: '#BA7517' }}
      >
        {loading ? 'Iscrivo...' : 'Iscrivimi alla lista d\'attesa'}
      </button>
    </form>
  )
}
