import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  // ------------------------------------------------------------
  // 0. Redirect http -> https in produzione
  // ------------------------------------------------------------
  // Vercel termina TLS al suo edge e rimette 'x-forwarded-proto'.
  // In locale usiamo http, quindi saltiamo quando NODE_ENV e' development.
  if (process.env.NODE_ENV === 'production') {
    const proto = request.headers.get('x-forwarded-proto')
    if (proto && proto !== 'https') {
      const url = request.nextUrl.clone()
      url.protocol = 'https:'
      return NextResponse.redirect(url, 301)
    }
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  // Pagine di login/registrazione: se gia' loggato come admin, vai a /admin.
  if (pathname === '/admin/login' && session) {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (vendor?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  // Proteggi /admin/* (escluso /admin/login): richiede sessione + ruolo admin
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    const { data: vendor } = await supabase
      .from('vendors')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (vendor?.role !== 'admin') {
      const url = new URL('/', request.url)
      url.searchParams.set('error', 'not_admin')
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  // Matcher che copre admin + API (per rate limit e security headers su tutto).
  // Per ora il middleware fa solo auth+https; i security headers sono in
  // next.config.js e vengono applicati globalmente.
  matcher: ['/admin/:path*'],
}
