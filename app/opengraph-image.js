import { ImageResponse } from 'next/og'

// Immagine dinamica per link preview (WhatsApp, Telegram, Facebook, Twitter).
// Next.js la renderizza a 1200x630 tramite @vercel/og.
// Path finale: /opengraph-image (esposto automaticamente da App Router).
//
// BUG-027: forziamo dynamic + runtime nodejs per evitare il prerender
// statico al build. Su Windows local + @vercel/og c'e' un bug noto in
// `fileURLToPath(import.meta.url)` durante il prerender che fa fallire
// la build con `TypeError: Invalid URL`. Skippando il prerender
// (dynamic = 'force-dynamic') l'immagine viene generata on-request,
// e in produzione (Vercel) il flusso e' identico ma in un ambiente
// dove import.meta.url e' valido.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Mercati Soresina — prenota il tuo posteggio'

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height:      '100%',
          width:       '100%',
          display:     'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background:  'linear-gradient(135deg, #FAEEDA 0%, #FAC775 100%)',
          padding:     80,
          fontFamily:  'system-ui, sans-serif',
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
            marginTop:   48,
            display:     'flex',
            alignItems:  'center',
            fontSize:    28,
            color:       '#ffffff',
            background:  '#BA7517',
            padding:     '16px 28px',
            borderRadius: 16,
            alignSelf:   'flex-start',
          }}
        >
          mercati-soresina
        </div>
      </div>
    ),
    { ...size }
  )
}
