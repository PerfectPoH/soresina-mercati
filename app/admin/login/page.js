'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenziali non valide. Riprova.')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: '#BA7517' }}
          >
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="9" width="16" height="9" rx="1.5" fill="white" opacity="0.9"/>
              <path d="M1 9L10 2L19 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="7" y="12" width="3" height="3" rx="0.5" fill="#BA7517"/>
              <rect x="11" y="12" width="3" height="3" rx="0.5" fill="#BA7517"/>
            </svg>
          </div>
          <h1 className="text-xl font-medium text-stone-900">Area gestione</h1>
          <p className="text-stone-400 text-sm mt-1">Pro Loco Soresina</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@proloco-soresina.it"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            {error && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: '#BA7517' }}
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-stone-400 mt-4">
          Accesso riservato agli amministratori Pro Loco
        </p>
      </div>
    </div>
  )
}
