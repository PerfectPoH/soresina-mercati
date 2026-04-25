// Sentry configuration: lato Node.js (server components, API routes,
// middleware in runtime "nodejs"). Caricato automaticamente da
// @sentry/nextjs all'init del server bundle.

import * as Sentry from '@sentry/nextjs'

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,

    tracesSampleRate: 0.1,

    environment:
      process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

    release: process.env.VERCEL_GIT_COMMIT_SHA,

    sendDefaultPii: false,

    // Stessa scrubber logic del client per coerenza: rimuove i token dai
    // query string nelle URL catturate.
    beforeSend(event) {
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url)
          for (const k of ['token', 'access_token', 'refresh_token', 'code']) {
            if (u.searchParams.has(k)) u.searchParams.set(k, '[redacted]')
          }
          event.request.url = u.toString()
        } catch {
          /* noop */
        }
      }
      // Rimuovi l'header Authorization se per qualche motivo e' stato catturato
      if (event.request?.headers) {
        delete event.request.headers.authorization
        delete event.request.headers.Authorization
        delete event.request.headers.cookie
        delete event.request.headers.Cookie
      }
      return event
    },
  })
}
