'use client'

import { useState } from 'react'

// Bottone "Cancella il mio account" — flusso a due passi con
// conferma testuale ("CANCELLA") per evitare click accidentali.
export default function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false)
  const [typed,      setTyped]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  async function handleDelete() {
    if (typed.trim().toUpperCase() !== 'CANCELLA') {
      setError('Scrivi CANCELLA per confermare.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || 'Errore durante la cancellazione.')
        setLoading(false)
        return
      }
      // Account eliminato: forziamo il logout pulendo i cookie e redirigendo.
      window.location.href = '/auth/logout'
    } catch (e) {
      setError('Errore di rete. Riprova.')
      setLoading(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm px-4 py-2 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-100 transition-colors"
      >
        Cancella il mio account
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-red-700">
        Per confermare, scrivi <strong>CANCELLA</strong> nel campo qui sotto.
      </p>
      <input
        type="text"
        value={typed}
        onChange={e => setTyped(e.target.value)}
        placeholder="CANCELLA"
        autoCapitalize="characters"
        className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 bg-white"
        disabled={loading}
      />
      {error && (
        <p className="text-red-600 text-xs bg-white border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setConfirming(false); setTyped(''); setError(null) }}
          disabled={loading}
          className="flex-1 text-sm px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="flex-1 text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Cancello...' : 'Sì, cancella'}
        </button>
      </div>
    </div>
  )
}
