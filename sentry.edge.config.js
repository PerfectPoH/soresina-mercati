// Sentry configuration: runtime "edge" (middleware, route handlers con
// export runtime = 'edge'). API piu' ristretta del server config.

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
  })
}
