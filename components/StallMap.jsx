'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BookingForm from './BookingForm'
import AdminStallPanel from './AdminStallPanel'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// Step zoom disponibili. 44px e' il minimo touch WCAG, quindi i livelli <44
// sono considerati "overview" e hanno un'avvertenza accessibilita' implicita
// (ingrandisci per toccare).
const ZOOM_STEPS = [32, 44, 56, 72, 92]
const DEFAULT_ZOOM_INDEX = 1 // -> 44px

export default function StallMap({ stalls, event, currentUser, currentVendor }) {
  const router = useRouter()
  const [selected, setSelected] = useState(null)
  const [localStalls, setLocalStalls] = useState(stalls)
  const [liveUpdate, setLiveUpdate] = useState(null) // { at, kind }
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const panelRef = useRef(null)
  const refreshTimer = useRef(null)

  const isAdmin = currentVendor?.role === 'admin'
  const cellSize = ZOOM_STEPS[zoomIndex]
  // Mostra i controlli zoom solo quando ha senso: eventi grandi (>50 posteggi)
  // oppure griglie molto larghe (>10 colonne) che tipicamente trabocchano.
  const showZoom = stalls.length > 50 || event.cols > 10

  // Quando cambiano gli stall dal server (dopo router.refresh()), sincronizza lo stato locale
  useEffect(() => {
    setLocalStalls(stalls)
    // Se c'e' un posteggio selezionato, aggiorna il suo riferimento con i dati freschi
    if (selected) {
      const fresh = stalls.find(s => s.id === selected.id)
      if (fresh) setSelected(fresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stalls])

  // Realtime: quando un'altra persona prenota o cambia stato a un posteggio
  // di questo evento, la mappa si aggiorna senza refresh manuale.
  // Serve che su Supabase la tabella `bookings` (e idealmente `stalls`) sia
  // abilitata alla replication: Dashboard > Database > Replication > add to
  // "supabase_realtime" publication. Senza questo il canale resta aperto
  // ma non arrivano eventi.
  useEffect(() => {
    const supa = createSupabaseBrowserClient()

    // Debounce: raggruppa N eventi vicini in un solo refresh
    function scheduleRefresh(kind) {
      setLiveUpdate({ at: Date.now(), kind })
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        router.refresh()
      }, 400)
    }

    const channel = supa
      .channel(`stalls-realtime-${event.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'bookings',
          filter: `event_id=eq.${event.id}`,
        },
        payload => scheduleRefresh(`booking_${payload.eventType?.toLowerCase() || 'change'}`)
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'stalls',
          filter: `event_id=eq.${event.id}`,
        },
        () => scheduleRefresh('stall_update')
      )
      .subscribe()

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supa.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  // Auto-clear del banner "aggiornata ora" dopo 3s
  useEffect(() => {
    if (!liveUpdate) return
    const t = setTimeout(() => setLiveUpdate(null), 3000)
    return () => clearTimeout(t)
  }, [liveUpdate])

  // Rete di sicurezza per mobile: quando l'utente torna sulla pagina
  // (back button, switch tra app, schermo che si riaccende), il browser
  // su telefono mette in pausa il websocket di Realtime e si perdono
  // gli eventi. Il "visibilitychange" + "focus" ci permettono di forzare
  // un refresh dei dati ogni volta che la scheda torna attiva.
  useEffect(() => {
    function refreshOnVisible() {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        router.refresh()
      }
    }
    window.addEventListener('focus', refreshOnVisible)
    document.addEventListener('visibilitychange', refreshOnVisible)
    return () => {
      window.removeEventListener('focus', refreshOnVisible)
      document.removeEventListener('visibilitychange', refreshOnVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Su mobile, quando l'utente seleziona un posteggio, scorri fino al pannello
  // di prenotazione (che e' sotto la mappa nel layout stacked). Senza questo,
  // il cambio di stato puo' sembrare "non avere fatto nulla" su telefoni.
  useEffect(() => {
    if (!selected || !panelRef.current) return
    // Solo sotto lg (Tailwind lg = 1024px): sopra, il pannello e' gia' visibile
    // nella sidebar e lo scroll darebbe fastidio.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      // Un piccolo delay per dare a React il tempo di renderizzare il form
      const t = setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
      return () => clearTimeout(t)
    }
  }, [selected])

  const rows = event.rows
  const cols = event.cols

  function getStall(rowIdx, colIdx) {
    return localStalls.find(s => s.row_idx === rowIdx && s.col_idx === colIdx)
  }

  function handleSelect(stall) {
    // L'admin puo' sempre cliccare per gestire il posteggio
    if (!isAdmin && stall.stall_status !== 'free') return
    setSelected(prev => prev?.id === stall.id ? null : stall)
  }

  function onBooked(booking) {
    setLocalStalls(prev =>
      prev.map(s =>
        s.id === booking.stall_id
          ? { ...s, stall_status: 'booked', vendor_name: booking.vendor_name, booking_status: 'confirmed' }
          : s
      )
    )
    setSelected(null)
    router.refresh()
  }

  function onConflict(stall) {
    setLocalStalls(prev =>
      prev.map(s =>
        s.id === stall.id
          ? { ...s, stall_status: 'booked', booking_status: 'confirmed' }
          : s
      )
    )
    router.refresh()
  }

  function onAdminUpdated() {
    // Dopo un'azione admin, forza refresh e chiudi il pannello
    setSelected(null)
    router.refresh()
  }

  const freeCount    = localStalls.filter(s => s.stall_status === 'free').length
  // Lo stato "pending" (prenotazione non ancora confermata) conta come occupato
  // nella UI del vendor: non e' libero, quindi non e' prenotabile.
  const busyCount    = localStalls.filter(s => s.stall_status === 'booked' || s.stall_status === 'pending').length
  const blockedCount = localStalls.filter(s => s.stall_status === 'blocked').length

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Mappa */}
      <div className="flex-1">
        {/* Stats */}
        <div className="flex gap-4 mb-4">
          {[
            { label: 'Disponibili', val: freeCount,           color: 'text-green-700' },
            { label: 'Occupati',    val: busyCount,           color: 'text-stone-500' },
            ...(blockedCount > 0 || isAdmin
              ? [{ label: 'Bloccati', val: blockedCount,      color: 'text-red-700'   }]
              : []),
            { label: 'Totale',      val: localStalls.length,  color: 'text-stone-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-stone-200 px-4 py-2.5 flex-1 text-center">
              <div className={`text-xl font-medium ${s.color}`}>{s.val}</div>
              <div className="text-xs text-stone-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Controlli zoom per eventi grandi */}
        {showZoom && (
          <div className="flex items-center justify-between mb-3 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-stone-500">Zoom mappa</span>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Controlli zoom mappa"
            >
              <button
                type="button"
                onClick={() => setZoomIndex(i => Math.max(0, i - 1))}
                disabled={zoomIndex === 0}
                aria-label="Diminuisci zoom"
                className="w-8 h-8 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-medium"
              >
                −
              </button>
              <span className="w-10 text-center text-stone-600 tabular-nums" aria-live="polite">
                {Math.round((cellSize / ZOOM_STEPS[DEFAULT_ZOOM_INDEX]) * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomIndex(i => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                disabled={zoomIndex === ZOOM_STEPS.length - 1}
                aria-label="Aumenta zoom"
                className="w-8 h-8 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-medium"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoomIndex(DEFAULT_ZOOM_INDEX)}
                aria-label="Ripristina zoom"
                className="ml-1 px-2 h-8 rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50 text-[11px]"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Indicatore aggiornamento live */}
        {liveUpdate && (
          <div
            role="status"
            aria-live="polite"
            className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            Mappa aggiornata in tempo reale
          </div>
        )}

        {/* Legenda */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-200 border border-green-500 inline-block" />
            Disponibile
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-stone-200 border border-stone-300 inline-block" />
            Occupato
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />
            In attesa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-200 border border-red-400 inline-block" />
            Bloccato
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded inline-block border-2 border-amber-500" style={{ background: '#FAC775' }} />
            Selezionato
          </span>
        </div>

        {/* Griglia bancarelle
            Mobile-first: ogni cella ha min 44x44px (WCAG 2.5.5 Target Size,
            Apple HIG, Material). Se le colonne totali eccedono la larghezza
            dello schermo, la griglia scorre orizzontalmente invece di
            comprimere le celle sotto la soglia di usabilita'.
            grid-auto-columns: minmax(44px, 1fr) permette alle celle di
            espandersi su desktop ma non scendere sotto 44px.
        */}
        <div className="bg-stone-100 rounded-xl p-3 sm:p-4 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-4">
          <div
            role="grid"
            aria-label={`Mappa posteggi ${event.title || 'mercato'}: ${rows} file per ${cols} colonne`}
            className="inline-block min-w-full"
          >
            {Array.from({ length: rows }, (_, rowIdx) => {
              const rowLetter = String.fromCharCode(65 + rowIdx)
              return (
                <div key={rowIdx} className="mb-4 last:mb-0" role="row">
                  <div className="text-xs text-stone-400 mb-1.5 tracking-wider">
                    Fila {rowLetter}
                  </div>
                  <div
                    className="grid gap-1.5 sm:gap-2"
                    style={{
                      // Su mobile: colonne min = cellSize. Su schermi stretti
                      // il container scrolla orizzontalmente. Su desktop larghi
                      // le celle si espandono fino a riempire.
                      // cellSize e' controllato dallo zoom utente (eventi grandi).
                      gridTemplateColumns: `repeat(${cols}, minmax(${cellSize}px, 1fr))`,
                    }}
                  >
                    {Array.from({ length: cols }, (_, colIdx) => {
                      const stall = getStall(rowIdx, colIdx)
                      if (!stall) {
                        // Spazio vuoto ma con min-height per allineare le righe
                        return <div key={colIdx} style={{ minHeight: cellSize }} role="gridcell" aria-hidden="true" />
                      }

                      const status     = stall.stall_status
                      const isBooked   = status === 'booked'
                      const isPending  = status === 'pending'
                      const isBlocked  = status === 'blocked'
                      const isFree     = status === 'free'
                      const isSelected = selected?.id === stall.id
                      // I non-admin possono interagire SOLO con posteggi liberi.
                      // Booked/pending/blocked sono tutti non-cliccabili per vendor.
                      const disabled   = !isAdmin && !isFree

                      // min-w/h = cellSize -> scala con zoom utente.
                      // aspect-square mantiene la proporzione quadrata.
                      let cls = 'aspect-square rounded-md font-medium flex items-center justify-center transition-all duration-100 border touch-manipulation select-none '
                      // Testo piu' piccolo quando le celle sono piccole (overview 32px)
                      cls += cellSize < 44 ? 'text-[10px] ' : (cellSize < 60 ? 'text-xs sm:text-sm ' : 'text-sm ')
                      if (isSelected) {
                        cls += 'border-2 border-amber-500 scale-105 z-10 relative cursor-pointer text-amber-800'
                      } else if (isBlocked) {
                        cls += 'bg-red-200 border-red-400 text-red-800 '
                        cls += isAdmin ? 'cursor-pointer hover:bg-red-300 active:bg-red-300' : 'cursor-not-allowed opacity-70'
                      } else if (isBooked) {
                        cls += 'bg-stone-200 border-stone-300 text-stone-500 '
                        cls += isAdmin ? 'cursor-pointer hover:bg-stone-300 active:bg-stone-300' : 'cursor-not-allowed'
                      } else if (isPending) {
                        // Prenotazione non ancora confermata: giallo sabbia per
                        // distinguere visivamente da "booked" (grigio) senza
                        // confondere con "selected" (ambra piena).
                        cls += 'bg-amber-100 border-amber-300 text-amber-800 '
                        cls += isAdmin ? 'cursor-pointer hover:bg-amber-200 active:bg-amber-200' : 'cursor-not-allowed opacity-80'
                      } else {
                        cls += 'bg-green-100 border-green-400 text-green-800 hover:scale-105 active:scale-105 cursor-pointer hover:bg-green-200 active:bg-green-200'
                      }
                      // Focus ring visibile per tastiera (WCAG 2.4.7)
                      cls += ' focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1'

                      const title = isBlocked
                        ? `${stall.label} — Bloccato${stall.blocked_reason ? `: ${stall.blocked_reason}` : ''}`
                        : isBooked
                          ? `${stall.label} — ${stall.vendor_name || 'Occupato'}`
                          : isPending
                            ? `${stall.label} — In attesa di conferma`
                            : stall.label

                      // Label piu' descrittiva per screen reader
                      const ariaLabel = isBlocked
                        ? `Posteggio ${stall.label}, bloccato${stall.blocked_reason ? `: ${stall.blocked_reason}` : ''}`
                        : isBooked
                          ? `Posteggio ${stall.label}, occupato${stall.vendor_name ? ` da ${stall.vendor_name}` : ''}`
                          : isPending
                            ? `Posteggio ${stall.label}, in attesa di conferma`
                            : `Posteggio ${stall.label}, disponibile`

                      const btnStyle = { minWidth: cellSize, minHeight: cellSize }
                      if (isSelected) btnStyle.background = '#FAC775'

                      return (
                        <button
                          key={colIdx}
                          type="button"
                          role="gridcell"
                          className={cls}
                          style={btnStyle}
                          onClick={() => handleSelect(stall)}
                          title={title}
                          aria-label={ariaLabel}
                          aria-pressed={isSelected}
                          aria-disabled={disabled}
                          disabled={disabled}
                        >
                          {stall.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {/* Hint scroll su mobile quando la mappa e' piu' larga dello schermo */}
        {cols > 6 && (
          <p className="mt-2 text-xs text-stone-400 sm:hidden flex items-center gap-1" aria-live="polite">
            <span aria-hidden="true">←→</span>
            Scorri lateralmente per vedere tutta la mappa
          </p>
        )}
      </div>

      {/* Pannello laterale: admin -> AdminStallPanel, altrimenti BookingForm */}
      <div ref={panelRef} className="w-full lg:w-72 shrink-0 scroll-mt-4">
        {selected ? (
          isAdmin ? (
            <AdminStallPanel
              stall={selected}
              onCancel={() => setSelected(null)}
              onUpdated={onAdminUpdated}
            />
          ) : (
            <BookingForm
              stall={selected}
              event={event}
              currentUser={currentUser}
              currentVendor={currentVendor}
              onBooked={onBooked}
              onConflict={onConflict}
              onCancel={() => setSelected(null)}
            />
          )
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-400 text-sm">
            <div className="text-2xl mb-2">{isAdmin ? 'Admin' : 'Seleziona'}</div>
            {isAdmin
              ? 'Clicca un posteggio per gestirlo (bloccare, annullare prenotazioni, ecc.)'
              : 'Seleziona un posteggio verde dalla mappa per prenotarlo'}
          </div>
        )}
      </div>
    </div>
  )
}
