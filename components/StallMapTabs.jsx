'use client'

// Wrapper che alterna due viste della mappa:
//   - "Griglia": StallMap classico (layout a scacchiera, mobile-friendly)
//   - "Satellite": StallMapSatellite (Leaflet + tiles Esri, posizioni geo)
//
// Perche' due tab invece di scegliere una?
//   - La griglia e' piu' veloce e funziona senza JS Leaflet; resta il fallback
//     affidabile per mobile / connessioni lente / utenti con ad-blocker forti.
//   - La satellite e' piu' intuitiva ("ecco dove mi tocca") ma richiede che
//     l'admin abbia posizionato i posteggi. Finche' non e' posizionata,
//     il tab satellite mostra un messaggio e il tab griglia resta la scelta.
//
// Dynamic import della satellite con ssr:false: Leaflet accede a `window`
// al module load, quindi il bundle client-side e' l'unico posto dove puo'
// girare. next/dynamic gestisce il code-splitting: la satellite non viene
// scaricata finche' l'utente non clicca il tab.

import { useState } from 'react'
import dynamic from 'next/dynamic'
import StallMap from './StallMap'

const StallMapSatellite = dynamic(() => import('./StallMapSatellite'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Caricamento mappa satellite"
      className="rounded-2xl border border-stone-200 bg-stone-100 animate-pulse"
      style={{ height: 520 }}
    />
  ),
})

export default function StallMapTabs({ stalls, event, currentUser, currentVendor, isPast = false }) {
  const [tab, setTab] = useState('grid') // 'grid' | 'sat'

  return (
    <div>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Vista mappa posteggi"
        className="inline-flex rounded-xl border border-stone-200 bg-white p-1 mb-4 text-sm shadow-warm"
      >
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'grid'}
          aria-controls="tab-grid"
          onClick={() => setTab('grid')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tab === 'grid'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          <span className="mr-1.5" aria-hidden="true">▦</span>
          Griglia
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'sat'}
          aria-controls="tab-sat"
          onClick={() => setTab('sat')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tab === 'sat'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          <span className="mr-1.5" aria-hidden="true">🛰</span>
          Satellite
        </button>
      </div>

      {/* Pannelli. Non smontiamo il tab inattivo per preservarne lo stato
          (selezione posteggio), ma lo nascondiamo via hidden. Solo la mappa
          satellite NON viene montata finche' non si clicca il tab, cosi'
          evitiamo di caricare Leaflet per utenti che non lo vedranno. */}
      <div
        role="tabpanel"
        id="tab-grid"
        hidden={tab !== 'grid'}
        aria-labelledby="tab-grid-btn"
      >
        <StallMap
          stalls={stalls}
          event={event}
          currentUser={currentUser}
          currentVendor={currentVendor}
          isPast={isPast}
        />
      </div>

      <div
        role="tabpanel"
        id="tab-sat"
        hidden={tab !== 'sat'}
        aria-labelledby="tab-sat-btn"
      >
        {tab === 'sat' && (
          <StallMapSatellite
            stalls={stalls}
            event={event}
            currentUser={currentUser}
            currentVendor={currentVendor}
          />
        )}
      </div>
    </div>
  )
}
