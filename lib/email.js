import { Resend } from 'resend'
import { safeLogError } from './log'

// Wrapper Resend per email transazionali Soresina-Mercati.
//
// Design:
// - Singleton Resend client lazy-initialized: se RESEND_API_KEY manca al
//   build (es. preview senza env), il modulo non esplode all'import.
// - sendEmail() e' fail-safe: se l'invio fallisce non rompe il flow
//   chiamante (es. un webhook Stripe che ha gia' confermato il booking
//   non deve fallire perche' Resend e' down). Logghiamo l'errore via
//   safeLogError e ritorniamo { ok: false, error }.
// - Plain-text fallback automatico: se non passi `text`, lo deriviamo da
//   `html` strippando i tag (semplice ma sufficiente per email markup
//   nostro che e' minimal).
//
// Env richieste:
// - RESEND_API_KEY: chiave API Resend (production vs preview separate).
// - RESEND_FROM_EMAIL: mittente (es. "Pro Loco Soresina <noreply@prolocosoresina.it>").
//   Default: "Pro Loco Soresina <onboarding@resend.dev>" per testing
//   (limite 100/giorno, destinatario deve essere il proprio email account).
// - RESEND_REPLY_TO (opzionale): es. "info@prolocosoresina.it" per le
//   risposte degli utenti.

let _resend = null
function getClient() {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  _resend = new Resend(key)
  return _resend
}

const DEFAULT_FROM = 'Pro Loco Soresina <onboarding@resend.dev>'

/**
 * Strippa tag HTML per generare plain-text fallback.
 * Non e' un vero HTML parser: per le nostre email semplici basta.
 */
function htmlToText(html) {
  return String(html || '')
    // Rimuovi blocchi <style>/<script>
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Newline dopo block-level
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities basic
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @param {{
 *   to: string | string[],
 *   subject: string,
 *   html: string,
 *   text?: string,
 *   replyTo?: string,
 * }} args
 * @returns {Promise<{ ok: boolean, id?: string, error?: any }>}
 */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const client = getClient()
  if (!client) {
    safeLogError('[email] RESEND_API_KEY not configured, skipping send', { subject })
    return { ok: false, error: 'not_configured' }
  }
  if (!to) {
    return { ok: false, error: 'missing_recipient' }
  }

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM
  const reply_to = replyTo || process.env.RESEND_REPLY_TO || undefined

  try {
    const { data, error } = await client.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || htmlToText(html),
      ...(reply_to ? { reply_to } : {}),
    })
    if (error) {
      safeLogError('[email] Resend API error', error)
      return { ok: false, error }
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    safeLogError('[email] send failed', err)
    return { ok: false, error: err }
  }
}
