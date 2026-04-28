'use client'

// ============================================================================
// Mappa satellite dei posteggi — vista interattiva.
// ============================================================================
//
// Perche' Leaflet + Esri World Imagery?
//   - Google Maps richiede API key + billing abilitato (no thanks per una
//     Pro Loco). Leaflet e' open source (BSD), le tiles Esri "World Imagery"
//     sono gratis con attribution.
//   - Alternative valutate:
//       Mapbox -> free tier ok ma richiede token + account
//       OpenStreetMap standard -> niente satellite, solo mappa stradale
//       Maptiler -> free tier piccolissimo
//       Esri World Imagery -> gratis, attribution richiesta, zoom fino a 19
//
// Modalita' operative:
//   - VENDOR: vede i marker dei posteggi posizionati, clicca su uno verde
//     per prenotarlo (stesso BookingForm del tab griglia).
//   - ADMIN: puo' draggare i marker per riposizionarli, cliccare su un punto
//     vuoto per posizionare il "prossimo posteggio da posizionare", oppure
//     usare "Centra mappa qui" per salvare le coord di default dell'evento.
//
// Stato lat/lng: vive nel DB (stalls.latitude/longitude). Il componente
// fa update ottimistico sul marker drag e poi PATCH al server. Se il
// server rifiuta, fa rollback.
//
// SSR / window: Leaflet accede a `window` all'import, quindi questo
// componente DEVE essere caricato con `next/dynamic({ ssr: false })`
// dal wrapper StallMapTabs. Non importarlo direttamente da un Server
// Component (esploderebbe al build).
// ============================================================================

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import BookingForm from './BookingForm'
import AdminStallPanel from './AdminStallPanel'

// ---------------------------------------------------------------------------
// Icone custom: i default di Leaflet cercano file in /images/marker-icon.png
// che Webpack non serve. Invece di imbarcarci in workaround, generiamo icone
// SVG data-URI colorate per stato. Piu' leggere, zero 404, e piu' brand.
// ---------------------------------------------------------------------------
function makeStallIcon({ status, label, selected }) {
  const fill =
    status === 'blocked' ? '#DC2626' : // red-600
    status === 'booked'  ? '#78716C' : // stone-500
    status === 'pending' ? '#F59E0B' : // amber-500
                           '#16A34A'   // green-600 (free)

  const stroke = selected ? '#92400E' : '#1C1917' // amber-800 / stone-900
  const strokeW = selected ? 3 : 1.5
  const size = selected ? 38 : 30

  // Cerchio con label testuale. Il label e' gia' corto (es. "A1").
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}">
    <circle cx="20" cy="20" r="16" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
    <text x="20" y="25" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="#fff">${label}</text>
  </svg>`

  // encodeURIComponent senza btoa: supporta UTF-8 (es. etichette con accenti).
  const dataUri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  return L.icon({
    iconUrl: dataUri,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2], // centrato sul punto geo
    popupAnchor: [0, -size / 2],
  })
}

// Marker "ghost" per l'admin: posteggi non ancora posizionati (null lat/lng).
// Non sono sulla mappa (non hanno coord) ma compaiono in una lista laterale.
// Qui definiamo solo l'icona per quando l'admin clicca per posizionare.
function makeGhostIcon(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="34" height="34">
    <circle cx="20" cy="20" r="15" fill="#FEF3C7" stroke="#D97706" stroke-width="2" stroke-dasharray="3 2"/>
    <text x="20" y="25" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" fill="#92400E">${label}</text>
  </svg>`
  return L.icon({
    iconUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg),
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

// ---------------------------------------------------------------------------
// Hook interno: ricentra la mappa quando cambia il centro dell'evento
// (es. dopo "Centra mappa qui"). Senza questo hook la mappa resta statica
// anche se il DB viene aggiornato.
// ---------------------------------------------------------------------------
function MapController({ center, zoom }) {
  const map = useMap()
  // Useremo una dep stabile (string) invece di una array index access che
  // ESLint react-hooks/exhaustive-deps non riesce a tracciare bene.
  const centerKey = `${center[0]},${center[1]}`
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.4 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey, zoom, map])
  return null
}

// ---------------------------------------------------------------------------
// Hook interno: intercetta click su area vuota della mappa per posizionare
// il prossimo posteggio (solo admin, solo quando "placingStallId" e' set).
// ---------------------------------------------------------------------------
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng)
    },
  })
  return null
}

// Attribution compatta, come richiesto da Esri / Leaflet.
const ESRI_ATTRIB =
  '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, ' +
  'Maxar, Earthstar Geographics | ' +
  '<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>'

export default function StallMapSatellite({ stalls, event, currentUser, currentVendor }) {
  const router = useRouter()
  const isAdmin = currentVendor?.role === 'admin'

  // Stato locale per update ottimistici (drag marker, place marker, ecc.)
  const [localStalls, setLocalStalls] = useState(stalls)
  const [selected, setSelected] = useState(null)
  const [placingStallId, setPlacingStallId] = useState(null) // id del prossimo da piazzare
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [currentCenter, setCurrentCenter] = useState(null) // centro corrente (per "Centra qui")
  const [mapCenter, setMapCenter] = useState([
    Number(event.map_lat ?? 45.2872),
    Number(event.map_lng ?? 9.8572),
  ])
  const [mapZoom, setMapZoom] = useState(event.map_zoom ?? 19)
  const mapRef = useRef(null)

  useEffect(() => {
    setLocalStalls(stalls)
  }, [stalls])

  useEffect(() => {
    setMapCenter([Number(event.map_lat ?? 45.2872), Number(event.map_lng ?? 9.8572)])
    setMapZoom(event.map_zoom ?? 19)
  }, [event.map_lat, event.map_lng, event.map_zoom])

  // Toast che auto-sparisce dopo 2.5s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const positioned   = useMemo(() => localStalls.filter(s => s.latitude != null && s.longitude != null), [localStalls])
  const unpositioned = useMemo(() => localStalls.filter(s => s.latitude == null || s.longitude == null), [localStalls])

  // ---- API helpers ------------------------------------------------------
  async function patchStall(id, patch) {
    const res = await fetch(`/api/stalls/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.message || 'Errore di rete')
    return json.data
  }

  async function patchEvent(patch) {
    const res = await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.message || 'Errore di rete')
    return json.data
  }

  // Drag: update ottimistico + rollback in caso di errore.
  // Nota: uso `list` come nome del parametro dentro setLocalStalls per
  // evitare lo shadowing di `original` (che serve per il rollback).
  const handleDragEnd = useCallback(async (stall, latlng) => {
    if (!isAdmin) return
    const original = { latitude: stall.latitude, longitude: stall.longitude }
    // Ottimistico
    setLocalStalls(list =>
      list.map(s => s.id === stall.id ? { ...s, latitude: latlng.lat, longitude: latlng.lng } : s)
    )
    try {
      setSaving(true)
      await patchStall(stall.id, { latitude: latlng.lat, longitude: latlng.lng })
      setToast({ type: 'ok', msg: `Posteggio ${stall.label} spostato` })
    } catch (err) {
      // Rollback: ripristina le coord originali
      setLocalStalls(list =>
        list.map(s => s.id === stall.id ? { ...s, ...original } : s)
      )
      setToast({ type: 'err', msg: err.message || 'Errore salvando la posizione' })
    } finally {
      setSaving(false)
    }
  }, [isAdmin])

  // Click su area vuota: se l'admin sta piazzando uno stall, salva li'.
  const handleMapClick = useCallback(async (latlng) => {
    if (!isAdmin || !placingStallId) return
    const target = localStalls.find(s => s.id === placingStallId)
    if (!target) return
    // Ottimistico
    setLocalStalls(list =>
      list.map(s => s.id === placingStallId ? { ...s, latitude: latlng.lat, longitude: latlng.lng } : s)
    )
    const placingId = placingStallId
    setPlacingStallId(null)
    try {
      setSaving(true)
      await patchStall(placingId, { latitude: latlng.lat, longitude: latlng.lng })
      setToast({ type: 'ok', msg: `Posteggio ${target.label} posizionato` })
      router.refresh()
    } catch (err) {
      // Rollback (rimetti null)
      setLocalStalls(list =>
        list.map(s => s.id === placingId ? { ...s, latitude: null, longitude: null } : s)
      )
      setToast({ type: 'err', msg: err.message || 'Errore salvando la posizione' })
    } finally {
      setSaving(false)
    }
  }, [isAdmin, placingStallId, localStalls, router])

  // "Centra mappa qui": salva il centro corrente come default dell'evento.
  async function handleSaveCenter() {
    if (!isAdmin) return
    const map = mapRef.current
    if (!map) return
    const c = map.getCenter()
    const z = map.getZoom()
    try {
      setSaving(true)
      await patchEvent({ map_lat: c.lat, map_lng: c.lng, map_zoom: z })
      setToast({ type: 'ok', msg: 'Centro mappa salvato' })
      router.refresh()
    } catch (err) {
      setToast({ type: 'err', msg: err.message || 'Errore salvando il centro' })
    } finally {
      setSaving(false)
    }
  }

  // Remove posizionamento (admin).
  async function handleClearPosition(stall) {
    if (!isAdmin) return
    if (!confirm(`Rimuovere il posteggio ${stall.label} dalla mappa? (Potrai riposizionarlo dopo.)`)) return
    setLocalStalls(list =>
      list.map(s => s.id === stall.id ? { ...s, latitude: null, longitude: null } : s)
    )
    try {
      setSaving(true)
      await patchStall(stall.id, { latitude: null, longitude: null })
      setToast({ type: 'ok', msg: `Posteggio ${stall.label} rimosso dalla mappa` })
      router.refresh()
    } catch (err) {
      setLocalStalls(list =>
        list.map(s => s.id === stall.id ? { ...s, latitude: stall.latitude, longitude: stall.longitude } : s)
      )
      setToast({ type: 'err', msg: err.message || 'Errore rimuovendo' })
    } finally {
      setSaving(false)
    }
  }

  function handleSelect(stall) {
    if (!isAdmin && stall.stall_status !== 'free') return
    setSelected(prev => prev?.id === stall.id ? null : stall)
  }

  function onBooked() {
    setSelected(null)
    router.refresh()
  }

  function onConflict() { router.refresh() }
  function onAdminUpdated() { setSelected(null); router.refresh() }

  // ---- Render -----------------------------------------------------------
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {/* Barra admin */}
        {isAdmin && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-amber-900">Modalità editor</span>
              {placingStallId ? (
                <span className="text-amber-800 text-xs">
                  Clicca sulla mappa per posizionare
                  {' '}
                  <strong>{localStalls.find(s => s.id === placingStallId)?.label}</strong>
                </span>
              ) : (
                <span className="text-amber-700/80 text-xs">
                  Trascina i marker per spostare i posteggi. Clicca un posteggio nella lista a destra per posizionarlo.
                </span>
              )}
              <div className="ml-auto flex gap-2">
                {placingStallId && (
                  <button
                    type="button"
                    onClick={() => setPlacingStallId(null)}
                    className="px-3 py-1.5 rounded-md text-xs bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
                  >
                    Annulla
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveCenter}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-md text-xs bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Centra mappa qui
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-3 rounded-lg px-3 py-2 text-xs border ${
              toast.type === 'ok'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Mappa */}
        <div className="relative rounded-2xl overflow-hidden border border-stone-200 shadow-warm bg-stone-100" style={{ height: 520 }}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom
            className="h-full w-full"
            ref={mapRef}
            style={{ cursor: placingStallId ? 'crosshair' : 'grab' }}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution={ESRI_ATTRIB}
              maxZoom={19}
            />
            <MapController center={mapCenter} zoom={mapZoom} />
            <MapClickHandler onMapClick={handleMapClick} />

            {positioned.map(stall => (
              <Marker
                key={stall.id}
                position={[Number(stall.latitude), Number(stall.longitude)]}
                icon={makeStallIcon({
                  status: stall.stall_status,
                  label: stall.label,
                  selected: selected?.id === stall.id,
                })}
                draggable={isAdmin}
                eventHandlers={{
                  click: () => handleSelect(stall),
                  dragend: (e) => {
                    const m = e.target
                    const p = m.getLatLng()
                    handleDragEnd(stall, p)
                  },
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold text-stone-900">{stall.label}</div>
                    <div className="text-stone-600 mt-0.5">
                      {stall.stall_status === 'free'    && 'Disponibile'}
                      {stall.stall_status === 'booked'  && `Occupato${stall.vendor_name ? ` — ${stall.vendor_name}` : ''}`}
                      {stall.stall_status === 'blocked' && `Bloccato${stall.blocked_reason ? `: ${stall.blocked_reason}` : ''}`}
                      {stall.stall_status === 'pending' && 'In attesa di conferma'}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleClearPosition(stall)}
                        className="mt-2 text-red-700 underline text-[11px]"
                      >
                        Rimuovi dalla mappa
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Overlay "nessun posteggio posizionato" */}
          {positioned.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="bg-white/90 backdrop-blur px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-700 text-center max-w-xs shadow-warm">
                {isAdmin
                  ? 'Nessun posteggio posizionato. Clicca un posteggio nella lista a destra, poi clicca sulla mappa per piazzarlo.'
                  : 'I posteggi di questo mercato non sono ancora stati posizionati sulla mappa. Usa il tab "Griglia" per prenotare.'}
              </div>
            </div>
          )}
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#16A34A' }} />
            Disponibile
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#78716C' }} />
            Occupato
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#F59E0B' }} />
            In attesa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#DC2626' }} />
            Bloccato
          </span>
        </div>

        {/* Admin: lista posteggi da posizionare */}
        {isAdmin && unpositioned.length > 0 && (
          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-xs font-medium text-stone-700 mb-2">
              Da posizionare ({unpositioned.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unpositioned.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPlacingStallId(s.id)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    placingStallId === s.id
                      ? 'bg-amber-500 border-amber-600 text-white'
                      : 'bg-stone-50 border-stone-300 text-stone-700 hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {placingStallId && (
              <p className="text-[11px] text-amber-700 mt-2">
                ↑ Clicca sulla mappa per posizionare
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pannello laterale: stesso pattern di StallMap */}
      <div className="w-full lg:w-72 shrink-0">
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
            <div className="text-2xl mb-2">{isAdmin ? 'Editor' : 'Seleziona'}</div>
            {isAdmin
              ? 'Clicca un marker per gestirlo, oppure un posteggio dalla lista "Da posizionare".'
              : 'Clicca un marker verde sulla mappa satellite per prenotarlo.'}
          </div>
        )}
      </div>
    </div>
  )
}
