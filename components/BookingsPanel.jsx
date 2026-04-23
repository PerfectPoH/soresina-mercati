'use client'

import { useState, useMemo } from 'react'
import AdminBookingRow from './AdminBookingRow'

// Pannello prenotazioni dell'admin con:
//   - ricerca testuale per nome venditore / telefono / email
//   - filtro per evento (select)
//   - export CSV delle prenotazioni filtrate
export default function BookingsPanel({ bookings, events }) {
  const [query,   setQuery]   = useState('')
  const [eventId, setEventId] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings.filter(b => {
      if (eventId !== 'all' && b.event_id !== eventId) return false
      if (!q) return true
      const hay = [
        b.vendor_name,
        b.vendor_phone,
        b.vendor_email,
        b.goods_type,
        b.stalls?.label,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [bookings, query, eventId])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider">
          Prenotazioni ({filtered.length}{filtered.length !== bookings.length ? ` di ${bookings.length}` : ''})
        </h2>
        <AdminBookingRow exportMode bookings={filtered} />
      </div>

      {/* Filtri */}
      <div className="bg-white border border-stone-200 rounded-xl p-3 mb-3 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cerca venditore, telefono, merce..."
          className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
        />
        <select
          value={eventId}
          onChange={e => setEventId(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 bg-white sm:w-56"
        >
          <option value="all">Tutti gli eventi</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>
        {(query || eventId !== 'all') && (
          <button
            type="button"
            onClick={() => { setQuery(''); setEventId('all') }}
            className="text-xs text-stone-500 hover:text-stone-800 underline"
          >
            Reset
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
          {bookings.length === 0
            ? 'Nessuna prenotazione ancora'
            : 'Nessun risultato con questi filtri'}
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Posto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Venditore</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Merce</th>
                <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <AdminBookingRow
                  key={b.id}
                  booking={b}
                  isLast={i === filtered.length - 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
