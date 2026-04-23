'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Toast globale via React context. Uso:
//
//   const toast = useToast()
//   toast.error('Qualcosa e\' andato storto')
//   toast.success('Salvato!')
//   toast.info('Sincronizzazione...')
//
// Vengono mostrati in basso a destra, si chiudono da soli dopo 5s.
// Fino a 4 toast in coda; i piu' vecchi scalano.

const ToastContext = createContext({
  push:     () => {},
  success:  () => {},
  error:    () => {},
  info:     () => {},
})

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((message, kind = 'info', durationMs = 5000) => {
    const id = nextId++
    setToasts(prev => [...prev.slice(-3), { id, message, kind }])
    if (durationMs > 0) {
      const handle = setTimeout(() => remove(id), durationMs)
      timers.current.set(id, handle)
    }
    return id
  }, [remove])

  useEffect(() => () => {
    // Cleanup timers alla smontata
    timers.current.forEach(t => clearTimeout(t))
    timers.current.clear()
  }, [])

  const api = {
    push,
    success: (msg, dur) => push(msg, 'success', dur),
    error:   (msg, dur) => push(msg, 'error', dur ?? 7000),
    info:    (msg, dur) => push(msg, 'info', dur),
    remove,
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

function ToastViewport({ toasts, onClose }) {
  if (toasts.length === 0) return null
  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 pointer-events-none max-w-sm ml-auto"
      role="region"
      aria-label="Notifiche"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-lg border flex items-start gap-3 ${styleFor(t.kind)}`}
        >
          <span aria-hidden="true" className="shrink-0 font-medium">
            {iconFor(t.kind)}
          </span>
          <div className="flex-1 leading-relaxed">{t.message}</div>
          <button
            type="button"
            onClick={() => onClose(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Chiudi notifica"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

function styleFor(kind) {
  switch (kind) {
    case 'success': return 'bg-green-50 text-green-900 border-green-200'
    case 'error':   return 'bg-red-50 text-red-900 border-red-200'
    default:        return 'bg-white text-stone-800 border-stone-200'
  }
}

function iconFor(kind) {
  switch (kind) {
    case 'success': return '✓'
    case 'error':   return '⚠'
    default:        return 'ℹ'
  }
}
