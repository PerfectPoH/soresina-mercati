'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Pannello admin quando viene cliccato un posteggio dalla mappa.
// Funzionalita':
//   - Vedere lo stato del posteggio (libero/occupato/bloccato)
//   - Se occupato: vedere venditore + merce + annullare la prenotazione
//   - Se libero: bloccarlo con motivazione
//   - Se bloccato: sbloccarlo
export default function AdminStallPanel({
  stall,
  onCancel,
  onUpdated,
}) {
  const router = useRouter()
  const [reason,  setReason]  = useState(stall.blocked_reason || '')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState(null)

  const status = stall.stall_status // 'free' | 'booked' | 'pending' | 'blocked'

  async function callApi(method, url, body) {
    setBusy(true)
    setError(null)
    try {
      const controller = new AbortController()
      const timeoutId  = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(url, {
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
      onUpdated?.()
      router.refresh()
      setBusy(false)
      return true
    } catch (err) {
      console.error('[AdminStallPanel] api error', err)
      setError(err?.name === 'AbortError' ? 'Timeout.' : 'Errore di rete.')
      setBusy(false)
      return false
    }
  }

  async function handleBlock() {
    await callApi('PATCH', `/api/stalls/${stall.id}`, {
      blocked: true,
      blocked_reason: reason,
    })
  }

  async function handleUnblock() {
    await callApi('PATCH', `/api/stalls/${stall.id}`, {
      blocked: false,
    })
  }

  async function handleCancelBooking() {
    if (!stall.booking_id) return
    if (!window.confirm(`Annullare la prenotazione di ${stall.vendor_name}?`)) return
    await callApi('DELETE', `/api/bookings/${stall.booking_id}`)
  }

  const statusBadge = {
    free:    { label: 'Libero',     bg: '#EAF3DE', fg: '#3B6D11' },
    booked:  { label: 'Occupato',   bg: '#F1EFE8', fg: '#5F5E5A' },
    pending: { label: 'In attesa',  bg: '#FEF3C7', fg: '#92400E' },
    blocked: { label: 'Bloccato',   bg: '#FDECEC', fg: '#B71C1C' },
  }[status] || { label: status, bg: '#EEE', fg: '#333' }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
        <div>
          <div className="font-medium text-stone-900">Posteggio {stall.label}</div>
          <div className="text-xs text-stone-400 mt-0.5">
            Fila {stall.label[0]} · Admin
          </div>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: statusBadge.bg, color: statusBadge.fg }}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Stato: OCCUPATO (prenotazione confermata) */}
      {status === 'booked' && (
        <div className="space-y-3 text-sm">
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="font-medium text-stone-800">{stall.vendor_name}</div>
            {stall.vendor_phone && (
              <div className="text-xs text-stone-400">{stall.vendor_phone}</div>
            )}
            <div className="text-xs text-stone-500 mt-1">
              Merce: <span className="text-stone-700">{stall.goods_type}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelBooking}
            disabled={busy}
            className="w-full text-sm border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {busy ? '...' : 'Annulla prenotazione'}
          </button>
        </div>
      )}

      {/* Stato: IN ATTESA DI CONFERMA (prenotazione non ancora confermata) */}
      {status === 'pending' && (
        <div className="space-y-3 text-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="font-medium text-amber-900">{stall.vendor_name || 'Prenotazione in attesa'}</div>
            <div className="text-xs text-amber-700 mt-1">
              Conferma non ancora effettuata. Puoi annullare la richiesta.
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelBooking}
            disabled={busy || !stall.booking_id}
            className="w-full text-sm border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {busy ? '...' : 'Annulla richiesta'}
          </button>
        </div>
      )}

      {/* Stato: LIBERO -> blocca */}
      {status === 'free' && (
        <div className="space-y-3">
          <label className="block text-xs text-stone-500">
            Motivo del blocco (opzionale)
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Es. Danneggiato, Riservato organizzazione"
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={handleBlock}
            disabled={busy}
            className="w-full text-sm rounded-lg py-2 text-white font-medium disabled:opacity-50"
            style={{ background: '#B71C1C' }}
          >
            {busy ? 'Blocco...' : 'Blocca posteggio'}
          </button>
        </div>
      )}

      {/* Stato: BLOCCATO -> sblocca */}
      {status === 'blocked' && (
        <div className="space-y-3">
          {stall.blocked_reason && (
            <div className="text-xs text-stone-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Motivo: {stall.blocked_reason}
            </div>
          )}
          <button
            type="button"
            onClick={handleUnblock}
            disabled={busy}
            className="w-full text-sm rounded-lg py-2 text-white font-medium disabled:opacity-50"
            style={{ background: '#3B6D11' }}
          >
            {busy ? 'Sblocco...' : 'Sblocca posteggio'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="w-full text-xs text-stone-400 hover:text-stone-600 mt-4 disabled:opacity-50"
      >
        Chiudi
      </button>
    </div>
  )
}
