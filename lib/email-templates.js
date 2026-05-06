/* eslint-disable */
// Template email transazionali per Soresina-Mercati.
//
// Stile: JSX-to-string inline (zero dipendenze nuove). Palette warm coerente
// con il sito (cream/amber/stone) e tipografia che cade graceful su Outlook
// (system fonts). I client email moderni leggono Inter/Fraunces dai webfont
// link di sistema; quelli vecchi cadono su sans-serif/serif default.
//
// Tutti i template ritornano { subject, html, text }. Il plain-text e' una
// versione semplificata leggibile da client testuali / screen reader.
//
// Variabili comuni:
//   - SITE_URL: NEXT_PUBLIC_SITE_URL o fallback.
//   - refCode: ultime 8 char dell'uuid maiuscole.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mercati-soresina.vercel.app'

// CSS dark mode opt-out — estratto fuori dal template literal della shell
// per evitare che ESLint si confonda con le `{` `}` letterali del CSS dentro
// un template ricorsivo (errore "Parsing error: Unexpected token, expected '}'").
// Non e' un problema runtime (node --check passa), e' solo il parser Babel
// usato da next/core-web-vitals che perde il conto delle graffe nested.
const DARK_MODE_CSS = [
  '/* Force light mode appearance on darken-clients (Gmail dark, Outlook). */',
  ':root { color-scheme: only light; supported-color-schemes: light; }',
  '/* Apple Mail: lascia stare i nostri colori warm anche in dark. */',
  '@media (prefers-color-scheme: dark) {',
  '  body, table, td { background-color: #FAF7F2 !important; color: #292524 !important; }',
  '  .em-card { background-color: #ffffff !important; color: #292524 !important; }',
  '  .em-meta { color: #A8A29E !important; }',
  '  .em-link { color: #BA7517 !important; }',
  '  .em-cta { background-color: #BA7517 !important; color: #ffffff !important; }',
  '}',
].join('\n')

function refCodeFromId(id) {
  return String(id || '').replace(/-/g, '').slice(-8).toUpperCase()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

// Layout shell condiviso: header con logo Pro Loco, container 600px,
// footer con link privacy + indirizzo. Niente immagini esterne (peggio
// in dark mode, peggio in spam filter), tutto inline-CSS.
function shell({ preheader, title, body, ctaUrl, ctaLabel }) {
  // Preheader: anteprima inbox prima dell'apertura. Truncate ~90 char.
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!--
  Dark mode handling: opt-OUT esplicito.
  - meta color-scheme dichiarata "only light" + supported-color-schemes "light":
    Apple Mail e iOS Mail rispettano questo e NON invertono i colori (era il
    problema riportato: gradient ambra + testi marroni che, una volta invertiti
    in dark mode automatico, diventavano illeggibili).
  - Outlook.com / Outlook desktop ignorano queste meta ma applicano un dark
    mode "soft" (mantengono background chiari su elementi con bg esplicito).
  - Gmail dark mode: applica conversioni heuristiche; teniamo i background
    inline su tutti gli elementi con sfondo per ridurre l'ambiguita'.
-->
<meta name="color-scheme" content="only light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
${'<style>' + DARK_MODE_CSS + '</style>'}
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#292524;line-height:1.55;">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAF7F2;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">

          <!-- Logo Pro Loco -->
          <tr>
            <td style="padding-bottom:24px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-weight:500;font-size:18px;color:#5B3A08;letter-spacing:0.02em;">
                Pro Loco Soresina
              </div>
              <div class="em-meta" style="font-size:11px;color:#A8A29E;text-transform:uppercase;letter-spacing:0.18em;margin-top:2px;">
                Mercati &middot; Bancarelle online
              </div>
            </td>
          </tr>

          <!-- Card principale -->
          <tr>
            <td class="em-card" style="background:#ffffff;border:1px solid #E7E5E4;border-radius:16px;padding:32px;color:#292524;">
              ${body}
              ${ctaUrl ? `
              <div style="margin-top:24px;">
                <a href="${escapeAttr(ctaUrl)}" class="em-cta" style="display:inline-block;background:#BA7517;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:500;font-size:15px;">
                  ${escapeHtml(ctaLabel || 'Apri sul sito')}
                </a>
              </div>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="em-meta" style="padding:24px 8px;font-size:11px;color:#A8A29E;line-height:1.5;">
              Pro Loco Soresina &middot; Comune di Soresina (CR)<br>
              Hai ricevuto questa email perché hai un account su <a href="${SITE_URL}" class="em-link" style="color:#BA7517;text-decoration:none;">mercati-soresina</a>.<br>
              <a href="${SITE_URL}/privacy" class="em-meta" style="color:#A8A29E;text-decoration:underline;">Privacy</a> &middot;
              <a href="${SITE_URL}/cookie" class="em-meta" style="color:#A8A29E;text-decoration:underline;">Cookie</a> &middot;
              <a href="${SITE_URL}/termini" class="em-meta" style="color:#A8A29E;text-decoration:underline;">Termini</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

// ============================================================
// EMAIL 1 — Conferma prenotazione (post-Stripe success)
// ============================================================
/**
 * @param {{
 *   to: string,
 *   bookingId: string,
 *   eventTitle: string,
 *   eventDate: string,
 *   eventLocation?: string,
 *   stallLabel?: string,
 *   paidPrice: number,
 *   vendorName?: string,
 * }} args
 */
export function bookingConfirmedEmail({ to, bookingId, eventTitle, eventDate, eventLocation, stallLabel, paidPrice, vendorName }) {
  const ref = refCodeFromId(bookingId)
  const url = `${SITE_URL}/prenotato/${bookingId}`
  const subject = `Prenotazione confermata · ${eventTitle}`
  const greeting = vendorName ? `Ciao ${escapeHtml(vendorName.split(' ')[0])},` : 'Ciao,'

  const body = `
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:500;color:#15803D;letter-spacing:-0.01em;line-height:1.15;margin-bottom:8px;">
      Prenotazione confermata.
    </div>
    <p style="margin:0 0 18px;color:#57534E;">
      ${greeting} il tuo posteggio per <strong style="color:#1C1917;">${escapeHtml(eventTitle)}</strong> e' riservato.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border-top:1px solid #F5F5F4;border-bottom:1px solid #F5F5F4;">
      <tr><td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;width:90px;">Data</td><td style="padding:10px 0;color:#1C1917;">${escapeHtml(formatDate(eventDate))}</td></tr>
      ${eventLocation ? `<tr><td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;border-top:1px solid #F5F5F4;">Luogo</td><td style="padding:10px 0;color:#1C1917;border-top:1px solid #F5F5F4;">${escapeHtml(eventLocation)}</td></tr>` : ''}
      ${stallLabel ? `<tr><td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;border-top:1px solid #F5F5F4;">Posteggio</td><td style="padding:10px 0;color:#1C1917;font-family:monospace;border-top:1px solid #F5F5F4;">${escapeHtml(stallLabel)}</td></tr>` : ''}
      <tr><td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;border-top:1px solid #F5F5F4;">Costo</td><td style="padding:10px 0;color:#BA7517;font-weight:600;border-top:1px solid #F5F5F4;">${paidPrice}&euro;</td></tr>
      <tr><td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;border-top:1px solid #F5F5F4;">Codice</td><td style="padding:10px 0;color:#1C1917;font-family:monospace;letter-spacing:0.06em;border-top:1px solid #F5F5F4;">${ref}</td></tr>
    </table>

    <p style="margin:18px 0 0;color:#57534E;font-size:14px;">
      Salva il codice o questa email. Arriva in piazza almeno 30 minuti prima dell'inizio del mercato.
    </p>
  `

  const text = [
    `Prenotazione confermata.`,
    ``,
    `${greeting.replace(/<[^>]+>/g, '')} il tuo posteggio per ${eventTitle} e' riservato.`,
    ``,
    `Data: ${formatDate(eventDate)}`,
    eventLocation ? `Luogo: ${eventLocation}` : null,
    stallLabel ? `Posteggio: ${stallLabel}` : null,
    `Costo: ${paidPrice}€`,
    `Codice: ${ref}`,
    ``,
    `Vedi sul sito: ${url}`,
    ``,
    `Salva il codice o questa email. Arriva in piazza almeno 30 minuti prima dell'inizio del mercato.`,
    ``,
    `-- Pro Loco Soresina`,
  ].filter(Boolean).join('\n')

  return {
    subject,
    html: shell({
      preheader: `Il tuo posteggio per ${eventTitle} il ${formatDate(eventDate)}.`,
      title: subject,
      body,
      ctaUrl: url,
      ctaLabel: 'Vedi prenotazione',
    }),
    text,
  }
}

// ============================================================
// EMAIL 2 — Annullamento da admin (con o senza rimborso)
// ============================================================
/**
 * @param {{
 *   to: string,
 *   bookingId: string,
 *   eventTitle: string,
 *   eventDate: string,
 *   reason: string,
 *   refunded: boolean,
 *   paidPrice: number,
 *   vendorName?: string,
 * }} args
 */
export function bookingCancelledByAdminEmail({ to, bookingId, eventTitle, eventDate, reason, refunded, paidPrice, vendorName }) {
  const url = `${SITE_URL}/prenotato/${bookingId}`
  const subject = `Prenotazione annullata · ${eventTitle}`
  const greeting = vendorName ? `Ciao ${escapeHtml(vendorName.split(' ')[0])},` : 'Ciao,'
  const refundBadge = refunded
    ? `<div style="display:inline-block;background:#F0FDF4;color:#15803D;font-size:11px;font-weight:500;padding:4px 10px;border-radius:999px;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.08em;">Rimborso emesso &middot; ${paidPrice}&euro;</div>`
    : `<div style="display:inline-block;background:#FEF3F2;color:#991B1B;font-size:11px;font-weight:500;padding:4px 10px;border-radius:999px;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.08em;">Senza rimborso</div>`

  const body = `
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:500;color:#1C1917;letter-spacing:-0.01em;line-height:1.15;margin-bottom:8px;">
      Prenotazione annullata.
    </div>
    <p style="margin:0 0 16px;color:#57534E;">
      ${greeting} l'organizzazione ha annullato la tua prenotazione per <strong style="color:#1C1917;">${escapeHtml(eventTitle)}</strong> del ${escapeHtml(formatDate(eventDate))}.
    </p>

    ${refundBadge}

    <div style="background:#FAFAF9;border:1px solid #E7E5E4;border-radius:8px;padding:16px;margin:8px 0 16px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;margin-bottom:6px;">Motivo</div>
      <div style="color:#1C1917;font-style:italic;line-height:1.5;">&ldquo;${escapeHtml(reason || '—')}&rdquo;</div>
    </div>

    ${refunded
      ? `<p style="margin:0;color:#57534E;font-size:14px;">Il rimborso di <strong>${paidPrice}&euro;</strong> e' stato emesso sulla carta usata al pagamento. Tipicamente arriva entro 5-10 giorni lavorativi.</p>`
      : `<p style="margin:0;color:#57534E;font-size:14px;">Per questo annullamento l'organizzazione non ha emesso rimborso. Per chiarimenti contatta la Pro Loco.</p>`
    }
  `

  const text = [
    `Prenotazione annullata.`,
    ``,
    `${greeting.replace(/<[^>]+>/g, '')} l'organizzazione ha annullato la tua prenotazione per ${eventTitle} del ${formatDate(eventDate)}.`,
    ``,
    refunded ? `Stato: RIMBORSO EMESSO (${paidPrice}€)` : `Stato: SENZA RIMBORSO`,
    ``,
    `Motivo: "${reason || '—'}"`,
    ``,
    refunded
      ? `Il rimborso di ${paidPrice}€ e' stato emesso sulla carta usata al pagamento. Tipicamente arriva entro 5-10 giorni lavorativi.`
      : `Per questo annullamento l'organizzazione non ha emesso rimborso. Per chiarimenti contatta la Pro Loco.`,
    ``,
    `Vedi dettagli: ${url}`,
    ``,
    `-- Pro Loco Soresina`,
  ].join('\n')

  return {
    subject,
    html: shell({
      preheader: refunded
        ? `Annullata con rimborso ${paidPrice}€. Motivo: ${(reason || '').slice(0, 60)}`
        : `Annullata senza rimborso. Motivo: ${(reason || '').slice(0, 60)}`,
      title: subject,
      body,
      ctaUrl: url,
      ctaLabel: 'Vedi dettagli',
    }),
    text,
  }
}

// ============================================================
// EMAIL 3 — Promozione waitlist (24h per pagare)
// ============================================================
/**
 * @param {{
 *   to: string,
 *   bookingId: string,
 *   eventTitle: string,
 *   eventDate: string,
 *   stallLabel?: string,
 *   paidPrice: number,
 *   vendorName?: string,
 * }} args
 */
export function waitlistPromotedEmail({ to, bookingId, eventTitle, eventDate, stallLabel, paidPrice, vendorName }) {
  const url = `${SITE_URL}/prenotato/${bookingId}`
  const subject = `Si e' liberato un posto · ${eventTitle}`
  const greeting = vendorName ? `Ciao ${escapeHtml(vendorName.split(' ')[0])},` : 'Ciao,'
  const isFree = Number(paidPrice) === 0
  const ctaLabel = isFree ? 'Conferma prenotazione' : 'Completa il pagamento'

  const body = `
    <div style="display:inline-block;background:#FEF3C7;color:#92400E;font-size:11px;font-weight:500;padding:4px 10px;border-radius:999px;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.08em;">
      Hai 24 ore
    </div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:500;color:#92400E;letter-spacing:-0.01em;line-height:1.15;margin-bottom:8px;">
      Si e' liberato un posto.
    </div>
    <p style="margin:0 0 16px;color:#57534E;">
      ${greeting} si e' liberato un posteggio per <strong style="color:#1C1917;">${escapeHtml(eventTitle)}</strong> e dato che eri in lista d'attesa, e' riservato per te.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border-top:1px solid #F5F5F4;border-bottom:1px solid #F5F5F4;">
      <tr><td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;width:90px;">Data</td><td style="padding:10px 0;color:#1C1917;">${escapeHtml(formatDate(eventDate))}</td></tr>
      ${stallLabel ? `<tr><td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;border-top:1px solid #F5F5F4;">Posteggio</td><td style="padding:10px 0;color:#1C1917;font-family:monospace;border-top:1px solid #F5F5F4;">${escapeHtml(stallLabel)}</td></tr>` : ''}
      <tr><td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E;border-top:1px solid #F5F5F4;">${isFree ? 'Importo' : 'Da pagare'}</td><td style="padding:10px 0;color:#BA7517;font-weight:600;border-top:1px solid #F5F5F4;">${isFree ? 'Gratuita' : `${paidPrice}€`}</td></tr>
    </table>

    <p style="margin:18px 0 0;color:#92400E;font-size:14px;font-weight:500;">
      ⏱ ${isFree ? 'Conferma' : 'Completa il pagamento'} entro 24 ore, altrimenti il posto viene riassegnato al successivo in lista.
    </p>
  `

  const text = [
    `Si e' liberato un posto. Hai 24 ore.`,
    ``,
    `${greeting.replace(/<[^>]+>/g, '')} si e' liberato un posteggio per ${eventTitle} e dato che eri in lista d'attesa, e' riservato per te.`,
    ``,
    `Data: ${formatDate(eventDate)}`,
    stallLabel ? `Posteggio: ${stallLabel}` : null,
    isFree ? `Prenotazione: GRATUITA` : `Da pagare: ${paidPrice}€`,
    ``,
    `IMPORTANTE: ${isFree ? 'conferma' : 'completa il pagamento'} entro 24 ore, altrimenti il posto viene riassegnato al successivo in lista.`,
    ``,
    `${ctaLabel}: ${url}`,
    ``,
    `-- Pro Loco Soresina`,
  ].filter(Boolean).join('\n')

  return {
    subject,
    html: shell({
      preheader: `Hai 24h per ${isFree ? 'confermare' : 'pagare'}. ${isFree ? 'Gratuita' : paidPrice + '€'} per ${eventTitle}.`,
      title: subject,
      body,
      ctaUrl: url,
      ctaLabel,
    }),
    text,
  }
}
