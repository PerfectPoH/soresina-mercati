'use client'

import { useState } from 'react'

// Immagine hero della card evento nella home.
// Client component perche' gestisce onError (funzione) + stato locale per
// il fallback: se l'URL e' rotto o assente, mostriamo il placeholder
// gradient ambra col disegno della bancarella.
// Perche' client? L'home (app/page.js) e' un Server Component e React
// non permette di passare handler (onError) a <img> dentro un server
// component (le funzioni non sono serializzabili -> runtime error).
export default function EventCardImage({ src }) {
  const [broken, setBroken] = useState(false)

  if (!src || broken) {
    return (
      <div
        className="w-full h-36 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #FAEEDA 0%, #FAC775 100%)' }}
        aria-hidden="true"
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M9 23 L24 11 L39 23 L39 26 L9 26 Z" fill="#BA7517" opacity="0.7"/>
          <rect x="13" y="30" width="8" height="9" rx="1.5" fill="#BA7517" opacity="0.6"/>
          <rect x="27" y="30" width="8" height="9" rx="1.5" fill="#BA7517" opacity="0.6"/>
        </svg>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="w-full h-36 object-cover bg-cream-100"
      onError={() => setBroken(true)}
    />
  )
}
