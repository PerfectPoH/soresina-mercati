/** @type {import('next').NextConfig} */

// Content-Security-Policy
// - 'self' per base
// - Supabase lato browser: domain anon-key URL (*.supabase.co)
// - 'unsafe-inline' su style e' necessario per Tailwind + styled-jsx inline
//   in Next dev; in prod preferiremmo toglierlo ma al momento Next inietta
//   style inline e senza 'unsafe-inline' le pagine appaiono non stilate.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase API (sostituisce '*.supabase.co' con il tuo progetto se vuoi restringere)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  // Embed Google Maps (solo l'URL ?output=embed, niente API key).
  // Serve esplicitamente perche' default-src 'self' bloccherebbe l'iframe.
  "frame-src 'self' https://www.google.com https://maps.google.com",
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

module.exports = nextConfig
