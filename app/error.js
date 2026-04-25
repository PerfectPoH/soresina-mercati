'use client'

// Error boundary di Next.js App Router: catture errori lato client/server
// che non sono stati gestiti a livello di pagina. Next lo wrappa
// automaticamente attorno alle route.
// Ref: https://nextjs.org/docs/app/api-reference/file-conventions/error
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // In produzione non logghiamo l'oggetto errore completo per evitare PII.
    if (process.env.NODE_ENV === 'development') {
      console.error('[app error]', error)
    }
    // Sentry: cattura l'errore se configurato (DSN presente).
    // Sentry.captureException e' safe no-op se non inizializzato.
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-2xl">
          ⚠
        </div>
        <h1 className="text-xl font-medium text-stone-900 mb-2">Qualcosa è andato storto</h1>
        <p className="text-stone-500 text-sm mb-6">
          Si è verificato un errore imprevisto. Puoi riprovare, o tornare alla home.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="text-sm px-4 py-2 rounded-lg text-white font-medium"
            style={{ background: '#BA7517' }}
          >
            Riprova
          </button>
          <a
            href="/"
            className="text-sm px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors no-underline"
          >
            Torna alla home
          </a>
        </div>
      </div>
    </div>
  )
}
