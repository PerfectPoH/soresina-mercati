import { createBrowserClient } from '@supabase/ssr'

// Singleton per-tab.
// Se ogni componente crea il suo client, piu' istanze provano ad acquisire
// lo stesso navigator lock `sb-<ref>-auth-token` e si rubano il lock a vicenda:
// @supabase/auth-js rilancia "Lock ... was released because another request stole it".
// Tenere un'unica istanza evita quella race.
let _client = null

export function createSupabaseBrowserClient() {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return _client
}
