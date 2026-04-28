'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Usato sia come riga tabella che come bottone export
export default function AdminBookingRow({ booking, isLast, exportMode, bookings }) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [cancelled,  setCancelled]  = useState(false)

  // Modalità export CSV
  if (exportMode) {
    function exportCSV() {
      const header = ['Posteggio', 'Evento', 'Venditore', 'Telefono', 'Email', 'Merce', 'Prenotato il']
      const rows = bookings.map(b => [
        b.stalls?.label || '',
        b.events?.title || '',
        b.vendor_name,
        b.vendor_phone || '',
        b.vendor_email || '',
        b.goods_type,
        new Date(b.created_at).toLocaleDateString('it-IT'),
      ])
      const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `prenotazioni-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }

    return (
      <button
        onClick={exportCSV}
        className="text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-lg px-3 py-1.5 transition-colors"
      >
        Esporta CSV
      </button>
    )
  }

  // Modalità riga tabella
  async function handleCancel() {
    if (!confirm(`Annullare la prenotazione di ${booking.vendor_name} (${booking.stalls?.label})?`)) return
    setCancelling(true)
    const res = await fetch(`/api/bookings/${booking.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCancelled(true)
      router.refresh()
    } else {
      alert('Errore nell\'annullamento. Riprova.')
      setCancelling(false)
    }
  }

  if (cancelled) return null

  // BUG-038: prenotazioni di eventi passati sono in sola lettura.
  // Annullarle non avrebbe senso (l'evento si è già svolto) e potrebbe
  // distorcere lo storico/statistiche.
  const todayIso  = new Date().toISOString().slice(0, 10)
  const isPastEv  = booking.events?.date && booking.events.date < todayIso

  return (
    <tr className={!isLast ? 'border-b border-stone-50' : ''} style={{ opacity: cancelling ? 0.4 : 1 }}>
      <td className="px-4 py-3">
        <span className="font-medium text-stone-800">{booking.stalls?.label || '—'}</span>
        <div className="text-xs text-stone-400">{booking.events?.title}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-stone-800">{booking.vendor_name}</div>
        {booking.vendor_phone && <div className="text-xs text-stone-400">{booking.vendor_phone}</div>}
      </td>
      <td className="hidden sm:table-cell px-4 py-3 text-stone-500 text-sm">{booking.goods_type}</td>
      <td className="px-4 py-3 text-right">
        {isPastEv ? (
          <span className="text-[11px] text-stone-400 italic">Storico</span>
        ) : (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
          >
            {cancelling ? '...' : 'Annulla'}
          </button>
        )}
      </td>
    </tr>
  )
}
