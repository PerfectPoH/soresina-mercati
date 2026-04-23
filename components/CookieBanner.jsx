'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Il sito usa solo cookie tecnici: per il GDPR + linee guida del Garante
// del 10 giugno 2021 non serve un banner di consenso con scelta granulare.
// Mostriamo comunque un'informativa di trasparenza che si chiude alla prima
// accettazione. La scelta e' salvata in un cookie tecnico (non di profilazione).
const ACK_COOKIE_NAME = 'mercati-cookie-ack'

function hasAck() {
  if (typeof document === 'undefined') return true
  return document.cookie.split('; ').some(c => c.startsWith(`${ACK_COOKIE_NAME}=`))
}

function setAck() {
  if (typeof document === 'undefined') return
  // 1 anno, scope intero sito, SameSite=Lax (default), niente httpOnly (va letto dal client).
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  document.cookie = `${ACK_COOKIE_NAME}=1; expires=${d.toUTCString()}; path=/; SameSite=Lax`
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Mostra solo se non ha gia' preso visione
    if (!hasAck()) setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:pb-6 pointer-events-none">
      <div className="max-w-3xl mx-auto bg-stone-900 text-stone-100 rounded-2xl shadow-xl p-4 sm:p-5 text-sm pointer-events-auto border border-stone-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 leading-relaxed">
            Questo sito usa solo <strong>cookie tecnici</strong> necessari
            all'autenticazione. Nessun tracker, nessuna profilazione.
            <span className="hidden sm:inline">{' '}</span>
            <Link href="/cookie" className="text-amber-300 underline underline-offset-2 hover:text-amber-200">
              Informativa cookie
            </Link>
            {' · '}
            <Link href="/privacy" className="text-amber-300 underline underline-offset-2 hover:text-amber-200">
              Privacy
            </Link>
          </div>
          <button
            type="button"
            onClick={() => { setAck(); setVisible(false) }}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: '#BA7517' }}
          >
            Ho capito
          </button>
        </div>
      </div>
    </div>
  )
}
