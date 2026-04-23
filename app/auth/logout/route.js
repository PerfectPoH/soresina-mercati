import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { safeLogError } from '@/lib/log'

// Logout lato server: pulisce i cookie httpOnly della sessione Supabase
// in modo definitivo, poi reindirizza alla home.
// Piu' affidabile di un logout solo lato client, che puo' lasciare
// residui di sessione nei cookie gestiti da @supabase/ssr.
export async function GET(request) {
  const supabase = createSupabaseServerClient()
  try {
    await supabase.auth.signOut()
  } catch (e) {
    safeLogError('[auth/logout]', e)
  }
  return NextResponse.redirect(new URL('/', request.url))
}

export async function POST(request) {
  return GET(request)
}
