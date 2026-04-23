'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function AccediPage() {
  const [mode, setMode]         = useState('password')  // 'password' | 'magic'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [magicSent, setMagicSent] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  // Al primo caricamento: se l'utente e' gia' loggato (es. appena tornato
  // dal magic link via email), sincronizza il profilo e redirigi.
  useEffect(() => {
    let cancelled = false
    // Safety net: se qualcosa si blocca mostriamo comunque il form.
    const timeout = setTimeout(() => {
      if (!cancelled) setBootstrapping(false)
    }, 5000)

    ;(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (session) {
          await ensureVendorProfile(supabase, session.user)
          if (cancelled) return
          await redirectByRole(supabase)
          return
        }
      } catch (_) {
        // bootstrap fallito: mostriamo comunque il form. Nessun log con PII.
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Inserisci l\u2019email.')
      return
    }
    setLoading(true)
    const supabase = createSupabaseBrowserClient()

    try {
      if (mode === 'password') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (loginError) {
          // Messaggio generico, non registriamo l'email tentata
          setError('Credenziali non valide. Riprova.')
          return
        }
        try {
          await ensureVendorProfile(supabase, data.user)
        } catch (_) {
          // silenzio: il profilo puo' essere completato al prossimo giro
        }
        // redirectByRole fa window.location.href — non torna indietro se va a buon fine.
        // Se torna, significa che c'e' stato un errore: sblocca l'UI.
        await redirectByRole(supabase)
      } else {
        // Magic link: manda email con link
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}/accedi` },
        })
        if (otpError) {
          setError(otpError.message || 'Errore nell\u2019invio del link. Riprova.')
          return
        }
        setMagicSent(true)
      }
    } catch (_) {
      // Non logghiamo l'oggetto errore che puo' contenere l'email tentata
      setError('Errore durante l\u2019accesso. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  if (bootstrapping) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-stone-400 text-sm">Accesso in corso...</div>
      </div>
    )
  }

  if (magicSent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center text-2xl">✉</div>
          <h1 className="text-xl font-medium text-stone-900">Controlla la tua email</h1>
          <p className="text-stone-500 text-sm mt-2">
            Ti abbiamo inviato un link a <span className="font-medium text-stone-700">{email}</span>. Cliccalo per accedere.
          </p>
          <p className="text-stone-400 text-xs mt-4">
            Non trovi la mail? Controlla lo spam, o richiedila tra qualche minuto.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-medium text-stone-900">Accedi</h1>
          <p className="text-stone-400 text-sm mt-1">Entra per prenotare i posteggi</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          {/* Scelta metodo */}
          <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-lg mb-5 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setMode('password'); setError(null) }}
              className={`py-2 rounded-md transition-colors ${mode === 'password' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setMode('magic'); setError(null) }}
              className={`py-2 rounded-md transition-colors ${mode === 'magic' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}
            >
              Magic link
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="mario@esempio.it"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
            {mode === 'password' && (
              <div>
                <label className="block text-xs text-stone-500 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            )}

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
              {loading ? 'Attendi...' : (mode === 'password' ? 'Accedi' : 'Invia link via email')}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-stone-500 mt-4">
          Non hai un account?{' '}
          <Link href="/registrati" className="text-amber-700 font-medium hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  )
}

// Assicura che esista una riga in `vendors` per l'utente autenticato.
// Se mancante, la crea leggendo i dati da user_metadata (settati in /registrati).
async function ensureVendorProfile(supabase, user) {
  if (!user) return
  const { data: existing } = await supabase
    .from('vendors')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return

  const md = user.user_metadata || {}
  // Se l'utente si e' registrato senza metadata (es. admin creato a mano),
  // creiamo un profilo placeholder. Potra' essere completato dopo.
  await supabase.from('vendors').insert({
    user_id:            user.id,
    email:              user.email,
    name:               md.name  || user.email?.split('@')[0] || 'Venditore',
    phone:              md.phone || '—',
    primary_goods_type: md.primary_goods_type || 'Altro',
    vat_number:         md.vat_number || null,
  })
}

// Dopo il login, redirigi verso /admin (se admin) o / (se venditore).
// Usiamo window.location.href per forzare una navigazione full-page cosi' che
// i cookie appena settati siano letti dal server component del Header e del
// middleware, senza dover fare router.refresh.
async function redirectByRole(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    let role = 'vendor'
    if (user) {
      const { data } = await supabase
        .from('vendors')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      role = data?.role || 'vendor'
    }
    if (typeof window !== 'undefined') {
      window.location.href = role === 'admin' ? '/admin' : '/'
    }
  } catch (_) {
    // Fallback alla home: nessun log per evitare PII nell'errore.
    if (typeof window !== 'undefined') window.location.href = '/'
  }
}
