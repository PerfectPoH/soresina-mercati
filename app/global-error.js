'use client'

// Global error boundary di Next.js App Router.
// Si attiva quando l'errore scoppia DENTRO il root layout.js (cioe' quando
// nemmeno la pagina error.js riesce a render-izzare). Deve fornire la sua
// <html>/<body> perche' sostituisce la root.
//
// Ref: https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs
//
// Qui inoltriamo l'errore a Sentry (se configurato) per tracciare crash
// React-render che altrimenti passerebbero silenti.

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="it">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1rem', textAlign: 'center', color: '#2C2418', background: '#FDFBF5' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
            Qualcosa è andato storto
          </h1>
          <p style={{ fontSize: 14, color: '#5F4B32', lineHeight: 1.6, marginBottom: 20 }}>
            Si è verificato un errore imprevisto. Il problema è stato
            segnalato automaticamente. Puoi provare a ricaricare la pagina.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              background: '#BA7517',
              color: '#FDFBF5',
              padding: '10px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            Torna alla home
          </a>
        </div>
      </body>
    </html>
  )
}
