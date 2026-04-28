import { ImageResponse } from 'next/og'

// API route che genera l'immagine Open Graph (1200x630) a runtime.
//
// BUG-027: prima questo file era `app/opengraph-image.js` (metadata file
// convention di Next.js App Router). Quel pattern viene prerender al build
// e su Windows local @vercel/og crashava su `fileURLToPath(import.meta.url)`
// con `TypeError: Invalid URL`. `export const dynamic = 'force-dynamic'`
// non e' sufficiente per i metadata files: vengono comunque processati al
// build. Spostandolo come route API (`/api/og`) Next.js NON la prerender,
// e l'immagine viene generata on-request. In produzione il comportamento
// e' identico per crawler/social card.
//
// L'URL viene dichiarato in `app/layout.js` come
// `metadata.openGraph.images = '/api/og'`.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIZE = { width: 1200, height: 630 }

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height:         '100%',
          width:          '100%',
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'center',
          background:     'linear-gradient(135deg, #FAEEDA 0%, #FAC775 100%)',
          padding:        80,
          fontFamily:     'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 32, color: '#8A5711', letterSpacing: 4, marginBottom: 12, textTransform: 'uppercase' }}>
          Pro Loco Soresina
        </div>
        <div style={{ fontSize: 88, fontWeight: 600, color: '#5B3A08', lineHeight: 1.05, marginBottom: 20 }}>
          Mercati di Soresina
        </div>
        <div style={{ fontSize: 40, color: '#8A5711', lineHeight: 1.2 }}>
          Prenota online il tuo posteggio per i mercati del paese
        </div>
        <div
          style={{
            marginTop:    48,
            display:      'flex',
            alignItems:   'center',
            fontSize:     28,
            color:        '#ffffff',
            background:   '#BA7517',
            padding:      '16px 28px',
            borderRadius: 16,
            alignSelf:    'flex-start',
          }}
        >
          mercati-soresina
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        // Cache 1h client + 1d edge: l'immagine e' statica, non rigenerarla
        // su ogni anteprima di link.
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
