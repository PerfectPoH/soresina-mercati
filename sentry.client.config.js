// Sentry configuration: lato browser.
// Caricato automaticamente da @sentry/nextjs all'init del client bundle.
// DSN via env NEXT_PUBLIC_SENTRY_DSN. Se vuoto, Sentry non inizializza.

import * as Sentry from '@sentry/nextjs'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,

    // Quanti eventi inviare. In prod teniamo alto (100%) per errori: il
    // free tier di Sentry copre 5k errori/mo, piu' che sufficiente per
    // un sito piccolo. Per le performance (trace) teniamo piu' basso.
    tracesSampleRate: 0.1,

    // Ambiente = production / preview / development.
    // Usato per filtrare gli errori nel dashboard Sentry.
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',

    // Release = commit SHA. Permette di associare errori a un deploy
    // specifico (serve anche per il linking source map).
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Privacy: non catturiamo IP nei breadcrumb, non mandiamo headers
    // che potrebbero contenere token.
    sendDefaultPii: false,

    // Ignora errori irrilevanti che sporcano solo il dashboard.
    ignoreErrors: [
      // Errore browser comune quando l'utente naviga via durante un fetch
      'AbortError',
      // Estensioni browser che iniettano script rotti
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Cancellazioni di navigation Next.js (normali)
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
    ],

    // Scrubber: rimuove eventuali token/password che scivolano nei
    // messaggi di errore prima che lascino il browser.
    beforeSend(event) {
      // Rimuovi query param sensibili dalle URL
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url)
          for (const k of ['token', 'access_token', 'refresh_token', 'code']) {
            if (u.searchParams.has(k)) u.searchParams.set(k, '[redacted]')
          }
          event.request.url = u.toString()
        } catch {
          /* noop: URL non parsabile, lasciamo com'e' */
        }
      }
      return event
    },
  })
}
