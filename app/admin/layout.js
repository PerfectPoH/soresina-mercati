import { createSupabaseServerClient } from '@/lib/supabase-server'
import LogoutButton from '@/components/LogoutButton'
import Link from 'next/link'

export default async function AdminLayout({ children }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  // La pagina di login non ha bisogno della navbar admin
  if (!session) return <>{children}</>

  return (
    <div>
      {/* Admin top bar */}
      <div className="bg-stone-900 text-stone-300 text-xs px-4 py-2 flex items-center gap-4 -mt-8 mb-6 rounded-lg">
        <span className="text-stone-500">Pannello admin</span>
        <div className="flex gap-3 ml-auto items-center">
          <Link href="/admin" className="hover:text-white transition-colors">Dashboard</Link>
          <Link href="/admin/eventi/nuovo" className="hover:text-white transition-colors">+ Nuovo evento</Link>
          <span className="text-stone-600">|</span>
          <span className="text-stone-500">{session.user.email}</span>
          <LogoutButton />
        </div>
      </div>
      {children}
    </div>
  )
}
