// Log helper con PII scrubbing.
//
// I log di Vercel (runtime) e di Supabase sono accessibili allo staff che ha
// le credenziali di progetto: non vogliamo che finiscano dentro email,
// telefoni, nomi o note dei venditori. Il GDPR considera anche i log
// come "trattamento", quindi meno PII si registrano, meglio e'.
//
// Regola pratica:
//   - NIENTE email/telefono/nome/testi di venditori nei log.
//   - OK: codici errore, nome classe errore, messaggi interni, path, method.
//   - Gli oggetti errore di Supabase (`PostgrestError`) contengono campi
//     `code`, `message`, `details`, `hint`: `details`/`hint` a volte
//     riportano il valore che ha violato un constraint (es. "Key
//     (email)=(mario@rossi.it) already exists.") -> VANNO FILTRATI.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE_RE = /\b(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]?)?\d{3,4}[ .-]?\d{3,4}\b/g

function scrubString(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(EMAIL_RE, '<email>')
    .replace(PHONE_RE, m => (m.replace(/\d/g, '').length > 2 ? m : '<phone>'))
}

// Estrae da un errore solo i campi sicuri da loggare.
function safeFields(err) {
  if (!err) return { kind: 'null' }
  if (typeof err === 'string') return { message: scrubString(err).slice(0, 200) }
  // Errore nativo JS
  const out = {}
  if (err.name)    out.name    = err.name
  if (err.code)    out.code    = err.code        // Supabase / Postgres
  if (err.status)  out.status  = err.status
  if (err.statusCode) out.statusCode = err.statusCode
  if (err.message) out.message = scrubString(String(err.message)).slice(0, 200)
  // Non includiamo details / hint / stack: potrebbero contenere valori PII
  // e non servono per triage in produzione.
  return out
}

export function safeLogError(tag, err) {
  // In dev stampiamo anche l'oggetto originale per comodita';
  // in produzione (Vercel) solo la versione sanificata.
  if (process.env.NODE_ENV === 'development') {
    console.error(tag, err)
    return
  }
  try {
    console.error(tag, safeFields(err))
  } catch (_) {
    console.error(tag, '<unlogable error>')
  }
}

export function safeLogInfo(tag, extra) {
  if (process.env.NODE_ENV === 'development') {
    console.log(tag, extra ?? '')
    return
  }
  // In produzione log informativi disabilitati (meno rumore, meno rischio PII)
}
