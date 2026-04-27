'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Form unificato per creare/modificare un evento.
// - Se `initialEvent` e' null: crea un nuovo evento (+ genera stalls + copia
//   posizioni dalla mappa dall'ultimo evento alla stessa location)
// - Se `initialEvent` e' presente: aggiorna l'evento (puo' AUMENTARE rows/cols
//   per aggiungere posteggi; le bancarelle esistenti e le prenotazioni
//   restano invariate). DIMINUIRE rows/cols non e' supportato perche'
//   distruggerebbe prenotazioni esistenti — l'API rifiuta.
export default function EventForm({ initialEvent = null }) {
  const router = useRouter()
  const isEdit = !!initialEvent

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const [form, setForm] = useState({
    title:           initialEvent?.title           ?? '',
    description:     initialEvent?.description     ?? '',
    date:            initialEvent?.date            ?? '',
    location:        initialEvent?.location        ?? 'Piazza Garibaldi, Soresina',
    rows:            initialEvent?.rows            ?? 5,
    cols:            initialEvent?.cols            ?? 8,
    price_per_stall: initialEvent?.price_per_stall ?? 35,
    image_url:       initialEvent?.image_url       ?? '',
    active:          initialEvent?.active          ?? true,
  })

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title || !form.date) {
      setError('Titolo e data sono obbligatori.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const url    = isEdit ? `/api/events/${initialEvent.id}` : '/api/events'
      const method = isEdit ? 'PATCH' : 'POST'

      const body = isEdit
        ? {
            title:           form.title,
            description:     form.description,
            date:            form.date,
            location:        form.location,
            // BUG-031: ora si possono modificare rows/cols (solo aumentando).
            // L'API rifiuta diminuzioni con messaggio esplicito.
            rows:            Number(form.rows),
            cols:            Number(form.cols),
            price_per_stall: Number(form.price_per_stall),
            image_url:       form.image_url?.trim() || '',
            active:          !!form.active,
          }
        : {
            title:           form.title,
            description:     form.description,
            date:            form.date,
            location:        form.location,
            rows:            Number(form.rows),
            cols:            Number(form.cols),
            price_per_stall: Number(form.price_per_stall),
            image_url:       form.image_url?.trim() || undefined,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const json = await res.json().catch(() => ({}))

      if (!res.ok && res.status !== 207) {
        if (json.error === 'not_authenticated') setError('Sessione scaduta. Ricarica la pagina e accedi di nuovo.')
        else if (json.error === 'forbidden')    setError('Solo gli admin possono modificare eventi.')
        else setError(json.message || 'Errore.')
        setLoading(false)
        return
      }

      if (json.warning === 'stalls_failed') {
        setError(json.message || 'Evento creato ma errore nella generazione bancarelle.')
        setLoading(false)
        return
      }

      if (isEdit) {
        router.push('/admin')
        router.refresh()
      } else {
        const eventId = json.data?.id
        router.push(eventId ? `/evento/${eventId}` : '/admin')
        router.refresh()
      }
    } catch (err) {
      console.error('[EventForm] fetch error', err)
      setError(err?.name === 'AbortError'
        ? 'Timeout: il server non risponde. Riprova.'
        : 'Errore di rete. Riprova.')
      setLoading(false)
    }
  }

  const totalStalls = Number(form.rows) * Number(form.cols)

  return (
    <div className="max-w-xl">
      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">

        <div>
          <label className="block text-xs text-stone-500 mb-1.5">Titolo evento *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Es. Mercato di Primavera"
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-stone-500 mb-1.5">Descrizione</label>
          <textarea
            value={form.description || ''}
            onChange={e => set('description', e.target.value)}
            placeholder="Breve descrizione dell'evento"
            rows={2}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">Data *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">Prezzo posteggio (€/g)</label>
            <input
              type="number"
              value={form.price_per_stall}
              onChange={e => set('price_per_stall', e.target.value)}
              min="0"
              step="0.5"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-stone-500 mb-1.5">Luogo</label>
          <input
            type="text"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs text-stone-500 mb-1.5">
            URL immagine <span className="text-stone-400">(opzionale)</span>
          </label>
          <input
            type="url"
            value={form.image_url}
            onChange={e => set('image_url', e.target.value)}
            placeholder="https://..."
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
          />
          {form.image_url && (
            <div className="mt-2 rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.image_url}
                alt="Anteprima"
                className="w-full h-32 object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
          )}
          <p className="text-[11px] text-stone-400 mt-1.5">
            Incolla un link pubblico (Imgur, Wikipedia, Drive pubblico). Appare come banner nella card dell'evento.
          </p>
        </div>

        {isEdit && (
          <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-4">
            <input
              id="active-toggle"
              type="checkbox"
              checked={!!form.active}
              onChange={e => set('active', e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <label htmlFor="active-toggle" className="text-sm text-stone-700">
              Evento attivo (visibile ai venditori)
            </label>
          </div>
        )}

        {/* Configurazione griglia — modificabile solo alla creazione */}
        <div className="bg-stone-50 rounded-xl p-4">
          <div className="text-xs font-medium text-stone-600 mb-3">
            Configurazione mappa bancarelle
            {isEdit && (
              <span className="ml-2 text-[10px] text-stone-400 font-normal">
                (non modificabile dopo la creazione)
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Righe (file)</label>
              <input
                type="number"
                value={form.rows}
                onChange={e => set('rows', e.target.value)}
                min="1" max="10"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Colonne (posti per fila)</label>
              <input
                type="number"
                value={form.cols}
                onChange={e => set('cols', e.target.value)}
                min="1" max="20"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 bg-white"
              />
            </div>
          </div>

          {/* Preview griglia */}
          <div className="text-xs text-stone-500 mb-2">Anteprima layout ({totalStalls} posteggi totali)</div>
          <div
            className="inline-grid gap-1"
            style={{ gridTemplateColumns: `repeat(${Math.min(form.cols, 12)}, 1fr)` }}
          >
            {Array.from({ length: Math.min(totalStalls, 60) }, (_, i) => (
              <div key={i} className="w-5 h-5 rounded bg-green-200 border border-green-400" />
            ))}
            {totalStalls > 60 && (
              <div className="text-xs text-stone-400 self-center col-span-full mt-1">
                +{totalStalls - 60} altri...
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 text-sm border border-stone-200 rounded-lg py-2.5 text-stone-500 hover:bg-stone-50 transition-colors"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 text-sm rounded-lg py-2.5 text-white font-medium transition-opacity disabled:opacity-50"
            style={{ background: '#BA7517' }}
          >
            {loading
              ? (isEdit ? 'Salvo modifiche...' : 'Creo evento...')
              : (isEdit ? 'Salva modifiche' : `Crea evento (${totalStalls} posteggi)`)}
          </button>
        </div>
      </form>
    </div>
  )
}
