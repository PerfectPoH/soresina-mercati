import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import HeaderClient from './HeaderClient'
import ThemeToggle from './ThemeToggle'

// Server component: legge la sessione dai cookie in modo che il primo render
// (anche lato server) mostri subito lo stato di autenticazione corretto,
// senza flash ne' "loading".
export default async function Header() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  let vendor = null
  if (session?.user) {
    const { data } = await supabase
      .from('vendors')
      .select('name, role')
      .eq('user_id', session.user.id)
      .maybeSingle()
    vendor = data
  }

  // Estraggo solo i campi che servono al client (evito di passare il token).
  const initialUser = session?.user
    ? { id: session.user.id, email: session.user.email }
    : null

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#BA7517' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="9" width="16" height="9" rx="1.5" fill="white" opacity="0.9"/>
              <path d="M1 9L10 2L19 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="7" y="12" width="3" height="3" rx="0.5" fill="#BA7517"/>
              <rect x="11" y="12" width="3" height="3" rx="0.5" fill="#BA7517"/>
            </svg>
          </div>
          <div>
            <span className="font-medium text-sm text-stone-900">Mercati Soresina</span>
            <span className="hidden sm:inline text-stone-400 text-sm"> — Pro Loco</span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <HeaderClient initialUser={initialUser} initialVendor={vendor} />
        </div>
      </div>
    </header>
  )
}
