// Validazione input + sanitizzazione server-side.
//
// Ogni API route deve passare i dati dall'utente attraverso uno di questi
// helper prima di inserirli nel DB. Motivi:
//   1. Limitiamo la lunghezza per evitare payload abnormi
//   2. Filtriamo caratteri di controllo e tag HTML (anti-XSS stored)
//   3. Validiamo formato (uuid, enum, data ISO) prima di colpire il DB
//
// Tutte le funzioni restituiscono { ok: true, value } in caso di successo
// o { ok: false, error: 'messaggio' } in caso di errore. Le API possono
// fermarsi al primo errore restituendo 400.

const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/
const PHONE_RE   = /^[0-9+\-\s().]{4,20}$/
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Elimina TAG HTML e caratteri di controllo da una stringa. Non sostituisce
// React auto-escaping, ma aggiunge una difesa in profondita' contro lo
// stored XSS (input salvato nel DB e in futuro mostrato altrove, es. email).
export function sanitizeText(value) {
  if (typeof value !== 'string') return ''
  return value
    // Rimuovi tag tipo <script>, <img>, ecc.
    .replace(/<[^>]*>/g, '')
    // Rimuovi caratteri di controllo (tranne \n \r \t)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
}

export function isString(v)  { return typeof v === 'string' }
export function isNumber(v)  { return typeof v === 'number' && Number.isFinite(v) }
export function isBool(v)    { return typeof v === 'boolean' }
export function isUuid(v)    { return isString(v) && UUID_RE.test(v) }
export function isIsoDate(v) { return isString(v) && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) }

export function validateString(value, { field, min = 0, max = 255, required = true, sanitize = true } = {}) {
  if (value == null || value === '') {
    if (required) return { ok: false, error: `${field} e' obbligatorio.` }
    return { ok: true, value: null }
  }
  if (typeof value !== 'string') return { ok: false, error: `${field} deve essere testo.` }
  const clean = sanitize ? sanitizeText(value) : value.trim()
  if (clean.length < min) return { ok: false, error: `${field} troppo corto (min ${min}).` }
  if (clean.length > max) return { ok: false, error: `${field} troppo lungo (max ${max}).` }
  return { ok: true, value: clean }
}

export function validateEmail(value, { field = 'Email', required = true } = {}) {
  const s = validateString(value, { field, max: 254, required })
  if (!s.ok) return s
  if (s.value && !EMAIL_RE.test(s.value)) return { ok: false, error: `${field} non valida.` }
  return s
}

export function validatePhone(value, { field = 'Telefono', required = false } = {}) {
  const s = validateString(value, { field, max: 30, required })
  if (!s.ok) return s
  if (s.value && !PHONE_RE.test(s.value)) return { ok: false, error: `${field} non valido.` }
  return s
}

export function validateUuid(value, { field = 'id' } = {}) {
  if (!isUuid(value)) return { ok: false, error: `${field} non valido.` }
  return { ok: true, value }
}

export function validateEnum(value, allowed, { field } = {}) {
  if (!allowed.includes(value)) {
    return { ok: false, error: `${field} non valido (valori ammessi: ${allowed.join(', ')}).` }
  }
  return { ok: true, value }
}

export function validateInt(value, { field, min, max, required = true } = {}) {
  if (value == null || value === '') {
    if (required) return { ok: false, error: `${field} e' obbligatorio.` }
    return { ok: true, value: null }
  }
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, error: `${field} deve essere un intero.` }
  if (min !== undefined && n < min) return { ok: false, error: `${field} deve essere >= ${min}.` }
  if (max !== undefined && n > max) return { ok: false, error: `${field} deve essere <= ${max}.` }
  return { ok: true, value: n }
}

export function validateNumber(value, { field, min, max, required = true } = {}) {
  if (value == null || value === '') {
    if (required) return { ok: false, error: `${field} e' obbligatorio.` }
    return { ok: true, value: null }
  }
  const n = Number(value)
  if (!Number.isFinite(n)) return { ok: false, error: `${field} deve essere un numero.` }
  if (min !== undefined && n < min) return { ok: false, error: `${field} deve essere >= ${min}.` }
  if (max !== undefined && n > max) return { ok: false, error: `${field} deve essere <= ${max}.` }
  return { ok: true, value: n }
}

export function validateIsoDate(value, { field = 'Data', required = true } = {}) {
  if (value == null || value === '') {
    if (required) return { ok: false, error: `${field} e' obbligatoria.` }
    return { ok: true, value: null }
  }
  if (!isIsoDate(value)) return { ok: false, error: `${field} in formato non valido (atteso YYYY-MM-DD).` }
  return { ok: true, value }
}

// Valida un URL pubblico. Solo http/https (no javascript:, data:, file:).
// Usato per hero image opzionale degli eventi, non per input critici.
export function validateUrl(value, { field = 'URL', required = false, max = 2000 } = {}) {
  if (value == null || value === '') {
    if (required) return { ok: false, error: `${field} e' obbligatorio.` }
    return { ok: true, value: null }
  }
  if (typeof value !== 'string') return { ok: false, error: `${field} deve essere testo.` }
  const trimmed = value.trim()
  if (trimmed.length > max) return { ok: false, error: `${field} troppo lungo (max ${max}).` }
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: `${field} non valido.` }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `${field} deve iniziare con http:// o https://.` }
  }
  return { ok: true, value: trimmed }
}

// Liste chiuse usate dall'app
export const GOODS_TYPES = [
  'Abbigliamento',
  'Alimentari',
  'Artigianato',
  'Fiori e piante',
  'Casalinghi',
  'Giocattoli',
  'Elettronica',
  'Altro',
]

// Helper per eseguire una sequenza di validazioni e fermarsi al primo errore.
// Ritorna { ok: true, data: {...} } oppure { ok: false, error }.
export function runValidators(pairs) {
  const data = {}
  for (const [key, result] of pairs) {
    if (!result.ok) return { ok: false, error: result.error }
    data[key] = result.value
  }
  return { ok: true, data }
}
