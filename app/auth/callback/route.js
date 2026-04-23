import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Route di callback per l'autenticazione via email/magic link.
//
// Quando Supabase manda un'email (magic link o conferma registrazione), il
// link include un parametro ?code=... Il codice e' inutile finche' qualcuno
// non lo scambia per una sessione vera tramite `exchangeCodeForSession`.
//
// Con @supabase/ssr (PKCE flow) lo scambio DEVE avvenire lato server, perche'
// il "code verifier" e' salvato in un cookie httpOnly che il JavaScript del
// browser non puo' leggere. Questa route gira lato server, quindi vede il
// cookie, fa lo scambio, e imposta i cookie di sessione (sb-...-auth-token).
//
// Configurazione correlata:
// - /accedi e /registrati devono usare emailRedirectTo: /auth/callback
// - Su Supabase: Authentication > URL Configuration > Redirect URLs
//   deve contenere: https://soresina-mercati.vercel.app/auth/callback
//   (e http://localhost:3000/auth/callback per lo sviluppo locale)
export async function GET(request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  // `next` permette di personalizzare dove mandare l'utente dopo il login
  // (es. /auth/callback?next=/admin). Di default andiamo su /accedi, che
  // rileva la sessione attiva e reindirizza in base al ruolo.
  const nextPath = url.searchParams.get('next') || '/accedi'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {
            try { cookieStore.set({ name, value, ...options }) } catch {}
          },
          remove(name, options) {
            try { cookieStore.set({ name, value: '', ...options }) } catch {}
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Codice scaduto, gia' usato, o invalido. Riporto l'utente al login
      // con un messaggio di errore generico (niente PII nell'URL).
      const retryUrl = new URL('/accedi', request.url)
      retryUrl.searchParams.set('error', 'auth_callback_failed')
      return NextResponse.redirect(retryUrl)
    }
  }

  // Tutto ok (o nessun codice da scambiare): redirigi alla destinazione.
  // I cookie di sessione sono gia' settati sulla response.
  return NextResponse.redirect(new URL(nextPath, request.url))
}
