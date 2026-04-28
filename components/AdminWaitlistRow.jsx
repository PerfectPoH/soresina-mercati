'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  })
}

export default function AdminWaitlistRow({ entry, position, isLast }) {
  const router = useRouter()
  const [busy,    setBusy]    = useState(false)
  const [removed, setRemoved] = useState(false)

  async function handleRemove() {
    if (!window.confirm(`Rimuovere ${entry.vendor_name} dalla lista d'attesa?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/waitlist/${entry.id}`, { method: 'DELETE' })
      if (res.ok) {
        setRemoved(true)
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.message || 'Errore nella rimozione.')
        setBusy(false)
      }
    } catch {
      alert('Errore di rete.')
      setBusy(false)
    }
  }

  // BUG-041: promuovi manualmente. Crea un booking pending per questo
  // utente con scadenza 24h (gestita da release_expired_waitlist_promotions).
  // Usato dall'admin quando un posto si libera ma il sistema non ha promosso
  // automaticamente (es. blocco/sblocco manuale, o lista generale).
  async function handlePromote() {
    const stallLabel = entry.stall_id ? '(posto specifico)' : '(da assegnare a un posto libero)'
    if (!window.confirm(`Promuovere ${entry.vendor_name} ${stallLabel}? Avrà 24h per pagare.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/waitlist/${entry.id}/promote`, { method: 'POST' })
      if (res.ok) {
        setRemoved(true)
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.message || 'Errore nella promozione.')
        setBusy(false)
      }
    } catch {
      alert('Errore di rete.')
      setBusy(false)
    }
  }

  if (removed) return null

  return (
    <tr className={!isLast ? 'border-b border-stone-50' : ''} style={{ opacity: busy ? 0.4 : 1 }}>
      <td className="px-4 py-3 text-stone-400 text-xs">{position}</td>
      <td className="px-4 py-3">
        <div className="text-stone-800">{entry.vendor_name}</div>
        <div className="text-xs text-stone-400">
          {entry.vendor_phone || '—'}
          {entry.vendor_email ? ` · ${entry.vendor_email}` : ''}
        </div>
        {entry.notes && (
          <div className="text-xs text-stone-400 mt-1 italic">“{entry.notes}”</div>
        )}
      </td>
      <td className="hidden sm:table-cell px-4 py-3 text-stone-500 text-sm">{entry.goods_type}</td>
      <td className="hidden md:table-cell px-4 py-3 text-stone-400 text-xs">
        {formatDate(entry.created_at)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-3">
          <button
            type="button"
            onClick={handlePromote}
            disabled={busy}
            className="text-xs text-amber-700 hover:text-amber-900 transition-colors disabled:opacity-40 font-medium"
            title="Crea una prenotazione pending per questo utente, valida 24h"
          >
            {busy ? '...' : 'Promuovi'}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
          >
            Rimuovi
          </button>
        </div>
      </td>
    </tr>
  )
}
