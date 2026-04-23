import './globals.css'
import Header from '@/components/Header'
import CookieBanner from '@/components/CookieBanner'
import { ToastProvider } from '@/components/ToastProvider'
import Link from 'next/link'

// Base URL per costruire gli URL assoluti nei meta tag OG/Twitter.
// Next.js 14: se non settata, certi crawler vedono URL relativi e non
// riescono a scaricare l'immagine. In produzione conviene settarla su Vercel:
//   NEXT_PUBLIC_SITE_URL=https://mercati-soresina.vercel.app
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:  'Mercati Soresina — Prenota il tuo posteggio',
    template: '%s — Mercati Soresina',
  },
  description:
    'Prenota online il tuo posteggio ai mercati di Soresina. Gestione posteggi a cura di Pro Loco Soresina.',
  applicationName: 'Mercati Soresina',
  keywords: [
    'Soresina', 'mercato', 'mercati', 'posteggio', 'bancarella',
    'Pro Loco Soresina', 'Cremona', 'prenotazione mercato',
  ],
  authors: [{ name: 'Pro Loco Soresina' }],
  creator: 'Pro Loco Soresina',
  publisher: 'Pro Loco Soresina',
  // app/icon.svg viene raccolto in automatico, ma lo dichiariamo esplicitamente
  // cosi' funziona anche quando il browser chiede /favicon.ico.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type:        'website',
    locale:      'it_IT',
    url:         '/',
    siteName:    'Mercati Soresina',
    title:       'Mercati Soresina — Prenota il tuo posteggio',
    description:
      'Prenota online il tuo posteggio ai mercati di Soresina. Gestione posteggi a cura di Pro Loco Soresina.',
    // app/opengraph-image.js genera /opengraph-image automaticamente (1200x630).
    // Non serve referenziarla qui: Next la aggiunge al manifest OG in automatico.
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Mercati Soresina — Prenota il tuo posteggio',
    description: 'Prenota online il tuo posteggio ai mercati di Soresina.',
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:  true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  // I colori UI di Safari iOS e Chrome Android
  themeColor: '#BA7517',
  // Indica a iOS Safari che la pagina e' pensata per dispositivi mobili
  viewport: {
    width:       'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
}

// Script inline anti-FOUC per il tema scuro.
// Deve girare SINCRONO nel <head> prima del primo paint, altrimenti
// su connessioni lente l'utente vede un flash bianco passando a dark.
// Legge la preferenza da localStorage (chiave `mercati-theme`):
//   - 'dark'  -> classe `dark`
//   - 'light' -> nessuna classe
//   - 'system' o assente -> segue prefers-color-scheme
const themeBootScript = `
(function() {
  try {
    var pref = localStorage.getItem('mercati-theme') || 'system';
    var dark = pref === 'dark' ||
      (pref === 'system' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (_) {}
})();
`

export default function RootLayout({ children }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-stone-50">
        <ToastProvider>
          {/* Skip link: visibile solo con focus via tastiera.
              Permette agli utenti screen reader / tastiera di saltare
              la navigation e andare direttamente al contenuto (WCAG 2.4.1). */}
          <a href="#main" className="skip-link">
            Salta al contenuto principale
          </a>
          <Header />
          <main id="main" className="max-w-5xl mx-auto px-4 py-8" tabIndex={-1}>
            {children}
          </main>
          <footer
            className="border-t border-stone-200 mt-16 py-6 text-center text-sm text-stone-400"
            role="contentinfo"
          >
            <div>Pro Loco Soresina · Comune di Soresina (CR)</div>
            <nav className="mt-2 flex items-center justify-center gap-3 text-xs" aria-label="Link legali">
              <Link href="/privacy" className="hover:text-stone-600 transition-colors no-underline">Privacy</Link>
              <span className="text-stone-300" aria-hidden="true">·</span>
              <Link href="/cookie" className="hover:text-stone-600 transition-colors no-underline">Cookie</Link>
              <span className="text-stone-300" aria-hidden="true">·</span>
              <Link href="/termini" className="hover:text-stone-600 transition-colors no-underline">Termini</Link>
            </nav>
          </footer>
          <CookieBanner />
        </ToastProvider>
      </body>
    </html>
  )
}
