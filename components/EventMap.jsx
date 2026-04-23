// Mappa geografica statica (Google Maps embed) del luogo dell'evento.
// Server component: e' solo un iframe, niente JS lato client.
//
// Perche' l'embed senza API key?
//   Google Maps ha due modalita' di embed:
//     1) "Embed API" ufficiale (API key + billing) -> piu' features
//     2) URL "?output=embed" -> nessuna key, mappa base, rispettosa della
//        privacy (Google comunque setta un cookie di sessione).
//   Per Pro Loco (sito piccolo, nessun budget Maps) scegliamo l'opzione 2.
//
// Nota CSP: il dominio https://www.google.com e https://maps.google.com
// devono essere in frame-src (vedi next.config.js).
export default function EventMap({ location, title }) {
  if (!location) return null
  const query = encodeURIComponent(location)
  const src = `https://www.google.com/maps?q=${query}&output=embed&hl=it`

  return (
    <section className="mt-8" aria-label="Mappa geografica del luogo dell'evento">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-medium text-stone-700">Dove si trova</h2>
        <span className="text-xs text-stone-400">· {location}</span>
      </div>
      <div className="rounded-2xl overflow-hidden border border-stone-200 bg-cream-50 shadow-warm">
        <iframe
          src={src}
          title={`Mappa ${title || location}`}
          width="100%"
          height="320"
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          // sandbox minimo per limitare cosa puo' fare l'iframe di Google.
          // allow-scripts serve perche' Maps usa JS per renderizzare.
          // Non mettiamo allow-same-origin: l'iframe non puo' leggere i
          // cookie del nostro sito.
          sandbox="allow-scripts allow-popups allow-forms"
          aria-label={`Mappa di ${location}`}
        />
      </div>
      <p className="mt-2 text-[11px] text-stone-400">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-amber-dark transition-colors no-underline"
        >
          Apri in Google Maps ↗
        </a>
      </p>
    </section>
  )
}
