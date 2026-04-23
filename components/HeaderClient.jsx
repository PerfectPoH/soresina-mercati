'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function HeaderClient({ initialUser, initialVendor }) {
  const router = useRouter()
  const [user,   setUser]   = useState(initialUser || null)
  const [vendor, setVendor] = useState(initialVendor || null)
  const [menuOpen, setMenuOpen] = useState(false)

  // Sincronizza lo stato se l'utente fa login/logout mentre naviga.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user || null
      setUser(u)
      if (u) {
        const { data: v } = await supabase
          .from('vendors')
          .select('name, role')
          .eq('user_id', u.id)
          .maybeSingle()
        setVendor(v)
      } else {
        setVendor(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  function handleLogout() {
    // Redirect ad un endpoint server-side che pulisce i cookie httpOnly
    // della sessione Supabase. Navigazione full-page -> stato client resettato.
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/logout'
    }
  }

  if (user) {
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-100 transition-colors min-h-[44px]"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Menu utente ${vendor?.name || user.email}`}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
            style={{ background: '#BA7517' }}
            aria-hidden="true"
          >
            {(vendor?.name || user.email || '?').charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:inline text-stone-700 max-w-[140px] truncate text-sm">
            {vendor?.name || user.email}
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-stone-400" aria-hidden="true">
            <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              role="menu"
              aria-label="Menu utente"
              className="absolute right-0 top-full mt-1 w-56 bg-white border border-stone-200 rounded-xl shadow-lg z-50 py-1 text-sm"
            >
              <div className="px-3 py-2 border-b border-stone-100">
                <div className="font-medium text-stone-800 truncate">{vendor?.name || 'Venditore'}</div>
                <div className="text-xs text-stone-400 truncate">{user.email}</div>
              </div>
              <Link
                href="/profilo"
                onClick={() => setMenuOpen(false)}
                role="menuitem"
                className="block px-3 py-2 text-stone-700 hover:bg-stone-50 no-underline"
              >
                Il mio profilo
              </Link>
              {vendor?.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="block px-3 py-2 text-stone-700 hover:bg-stone-50 no-underline"
                >
                  Area gestione
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                role="menuitem"
                className="w-full text-left px-3 py-2 text-red-700 hover:bg-red-50"
              >
                Esci
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <nav className="flex items-center gap-3 text-sm" aria-label="Autenticazione">
      <Link
        href="/accedi"
        className="text-stone-600 hover:text-stone-900 transition-colors no-underline"
      >
        Accedi
      </Link>
      <Link
        href="/registrati"
        className="px-3 py-1.5 rounded-lg text-white text-xs font-medium no-underline"
        style={{ background: '#BA7517' }}
      >
        Registrati
      </Link>
    </nav>
  )
}
