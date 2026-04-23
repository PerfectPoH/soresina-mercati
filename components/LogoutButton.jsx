'use client'

// Logout lato server via /auth/logout (pulisce i cookie httpOnly
// gestiti da @supabase/ssr). Il signOut client da solo non bastava:
// restava il cookie di sessione e il middleware rimandava in /admin.
export default function LogoutButton() {
  function handleLogout() {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/logout'
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="text-stone-500 hover:text-red-400 transition-colors text-xs"
    >
      Esci
    </button>
  )
}
