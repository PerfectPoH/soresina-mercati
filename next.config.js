/** @type {import('next').NextConfig} */

// Content-Security-Policy
// - 'self' per base
// - Supabase lato browser: domain anon-key URL (*.supabase.co)
// - 'unsafe-inline' su style e' necessario per Tailwind + styled-jsx inline
//   in Next dev; in prod preferiremmo toglierlo ma al momento Next inietta
//   style inline e senza 'unsafe-inline' le pagine appaiono non stilate.
// - *.ingest.sentry.io + *.sentry.io per permettere gli eventi Sentry
//   (connect-src). Anche se SENTRY_DSN e' vuoto non fa male tenerlo.
// - /_vercel/insights/* gira stesso dominio, non serve aggiungere CSP per
//   Vercel Analytics.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // img-src: include explicitly Esri per le tile satellite Leaflet
  // (server.arcgisonline.com). Il wildcard https: gia' lo copriva, ma
  // lo scriviamo esplicitamente per documentazione e per se mai
  // restringeremo img-src in futuro.
  "img-src 'self' data: blob: https: https://server.arcgisonline.com",
  "font-src 'self' data:",
  // Supabase API + Esri tile requests + Sentry error ingest.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://server.arcgisonline.com https://*.ingest.sentry.io https://*.sentry.io",
  // frame-src: nessun iframe esterno necessario (rimosso Google Maps embed,
  // sostituito da Leaflet che usa tiles via <img> non <iframe>).
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy',   value: CSP_DIRECTIVES },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // HSTS: forza HTTPS per 2 anni. Vercel gia' lo aggiunge in produzione,
  // ma duplicarlo qui assicura che venga inviato anche su altri host.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
  // Tronca l'header "x-powered-by" che rivela Next.js
  poweredByHeader: false,
}

// =====================================================================
// Sentry wrapping
// =====================================================================
// withSentryConfig aggiunge il plugin webpack che carica i source map
// in build. Se SENTRY_AUTH_TOKEN e' assente (es. dev locale) il plugin
// e' no-op: non rompe la build.
// Silenziamo i log del plugin in build per ridurre rumore, e diciamo
// a Sentry di mascherare le route API nei trace.
// Il pacchetto @sentry/nextjs deve essere installato: se manca il
// require rompe. Lo carichiamo dentro un try/catch cosi' il build
// continua a funzionare anche se per qualche motivo il pacchetto non
// e' disponibile (es. check CI senza node_modules).
let configWithSentry = nextConfig
try {
  const { withSentryConfig } = require('@sentry/nextjs')
  configWithSentry = withSentryConfig(nextConfig, {
    // Sentry CLI options (solo build-time, non toccano il runtime)
    silent: true,
    org:     process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Non fallire la build se il token non e' settato (dev/local)
    dryRun: !process.env.SENTRY_AUTH_TOKEN,
  }, {
    // Sentry webpack plugin options
    widenClientFileUpload: true,
    hideSourceMaps: true,
    // Riduce la dimensione del bundle client rimuovendo i logger di Sentry
    disableLogger: true,
    // Auto-wrap API routes con Sentry errors handler
    autoInstrumentServerFunctions: true,
  })
} catch (err) {
  // @sentry/nextjs non installato o non importabile: procedi senza
  // eslint-disable-next-line no-console
  console.warn('[next.config] Sentry wrapping disattivato:', err?.message)
}

module.exports = configWithSentry
