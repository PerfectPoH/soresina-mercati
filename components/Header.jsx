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
        <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="Mercati Soresina - Home">
          {/* Logomark: tetto bancarella stilizzato. Inline SVG cosi' i
              colori del wordmark seguono il tema (dark mode) via classi CSS. */}
          <svg
            width="34"
            height="34"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect x="2" y="2" width="44" height="44" rx="11" fill="#BA7517"/>
            <path d="M9 23 L24 11 L39 23 L39 26 L9 26 Z" fill="#FAEEDA"/>
            <path d="M24 11 L39 23 L39 26 L24 26 Z" fill="#FAC775" opacity="0.55"/>
            <rect x="13" y="30" width="8" height="9" rx="1.5" fill="#FAEEDA" opacity="0.9"/>
            <rect x="27" y="30" width="8" height="9" rx="1.5" fill="#FAEEDA" opacity="0.9"/>
            <rect x="13" y="39.5" width="22" height="1.5" rx="0.75" fill="#5B3A08" opacity="0.35"/>
          </svg>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-[15px] text-stone-900 tracking-tight">Mercati Soresina</span>
            <span className="hidden sm:inline text-[10px] font-medium text-amber-dark uppercase tracking-wider">Pro Loco · Bancarelle online</span>
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
