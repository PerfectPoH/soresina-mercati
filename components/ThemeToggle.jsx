'use client'

import { useEffect, useState } from 'react'

// Tema chiaro/scuro con preferenza persistente.
//
// Persistenza: localStorage chiave `mercati-theme` = 'light' | 'dark' | 'system'.
// Se l'utente non ha mai scelto, rispecchia prefers-color-scheme del sistema.
//
// Il flash bianco iniziale (FOUC) e' evitato dallo script inline in
// app/layout.js che applica la classe `dark` su <html> prima del paint.

const STORAGE_KEY = 'mercati-theme'

function resolveTheme(pref) {
  if (pref === 'dark')  return 'dark'
  if (pref === 'light') return 'light'
  // system / undefined
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return
  if (theme === 'dark') document.documentElement.classList.add('dark')
  else                  document.documentElement.classList.remove('dark')
}

export default function ThemeToggle({ className = '' }) {
  // Preferenza utente (puo' essere 'light', 'dark', 'system')
  const [pref, setPref] = useState('system')
  // Tema effettivamente applicato
  const [theme, setTheme] = useState('light')
  const [mounted, setMounted] = useState(false)

  // Mount: leggi preferenza salvata
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || 'system'
      setPref(saved)
      const resolved = resolveTheme(saved)
      setTheme(resolved)
      applyTheme(resolved)
    } catch {
      // localStorage bloccato (cookie off). Usa prefers-color-scheme.
      const resolved = resolveTheme('system')
      setTheme(resolved)
      applyTheme(resolved)
    }
    setMounted(true)
  }, [])

  // Se l'utente ha pref = 'system', reagisci ai cambi del sistema
  useEffect(() => {
    if (pref !== 'system') return
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const handler = () => {
      const resolved = resolveTheme('system')
      setTheme(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [pref])

  function cyclePref() {
    // light -> dark -> system -> light ...
    const next = pref === 'light' ? 'dark' : pref === 'dark' ? 'system' : 'light'
    setPref(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    const resolved = resolveTheme(next)
    setTheme(resolved)
    applyTheme(resolved)
  }

  // Evita mismatch SSR/client: finche' non montato, render neutro
  if (!mounted) {
    return (
      <button
        type="button"
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-stone-400 ${className}`}
        aria-hidden="true"
        tabIndex={-1}
      />
    )
  }

  const label =
    pref === 'dark'   ? 'Tema scuro (clicca per automatico)'
    : pref === 'light' ? 'Tema chiaro (clicca per scuro)'
    : `Tema automatico — attualmente ${theme === 'dark' ? 'scuro' : 'chiaro'} (clicca per chiaro)`

  return (
    <button
      type="button"
      onClick={cyclePref}
      aria-label={label}
      title={label}
      className={`w-9 h-9 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100 transition-colors ${className}`}
    >
      {pref === 'system' ? (
        // Auto / sistema: icona cerchio mezzo pieno
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 3 a7 7 0 0 0 0 14 z" fill="currentColor" />
        </svg>
      ) : theme === 'dark' ? (
        // Luna
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M15.5 12a6 6 0 0 1-8-8 6.5 6.5 0 1 0 8 8z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Sole
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 2v2" />
            <path d="M10 16v2" />
            <path d="M2 10h2" />
            <path d="M16 10h2" />
            <path d="M4.2 4.2l1.4 1.4" />
            <path d="M14.4 14.4l1.4 1.4" />
            <path d="M4.2 15.8l1.4-1.4" />
            <path d="M14.4 5.6l1.4-1.4" />
          </g>
        </svg>
      )}
    </button>
  )
}
