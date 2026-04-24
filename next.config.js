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
  // img-src: include explicitly Esri per le tile satellite Leaflet
  // (server.arcgisonline.com). Il wildcard https: gia' lo copriva, ma
  // lo scriviamo esplicitamente per documentazione e per se mai
  // restringeremo img-src in futuro.
  "img-src 'self' data: blob: https: https://server.arcgisonline.com",
  "font-src 'self' data:",
  // Supabase API + Esri tile requests (fetch tile layers).
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://server.arcgisonline.com",
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

module.exports = nextConfig
