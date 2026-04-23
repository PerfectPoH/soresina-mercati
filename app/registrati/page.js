'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

const GOODS_TYPES = [
  'Abbigliamento',
  'Alimentari',
  'Artigianato',
  'Fiori e piante',
  'Casalinghi',
  'Giocattoli',
  'Elettronica',
  'Altro',
]

export default function RegistratiPage() {
  const router = useRouter()
  const [mode, setMode] = useState('password') // 'password' | 'magic'
  const [form, setForm] = useState({
    email:              '',
    password:           '',
    password_confirm:   '',
    name:               '',
    phone:              '',
    primary_goods_type: GOODS_TYPES[0],
    vat_number:         '',
  })
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.email.trim() || !form.name.trim() || !form.phone.trim()) {
      setError('Email, nome e telefono sono obbligatori.')
      return
    }

    if (!consent) {
      setError('Devi accettare il trattamento dei dati per registrarti.')
      return
    }

    if (mode === 'password') {
      const pw = form.password
      if (pw.length < 10) {
        setError('La password deve avere almeno 10 caratteri.')
        return
      }
      if (!/[A-Z]/.test(pw)) {
        setError('La password deve contenere almeno una lettera maiuscola.')
        return
      }
      if (!/[a-z]/.test(pw)) {
        setError('La password deve contenere almeno una lettera minuscola.')
        return
      }
      if (!/[0-9]/.test(pw)) {
        setError('La password deve contenere almeno un numero.')
        return
      }
      if (form.password !== form.password_confirm) {
        setError('Le due password non coincidono.')
        return
      }
    }

    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const profile = {
      name:               form.name.trim(),
      phone:              form.phone.trim(),
      primary_goods_type: form.primary_goods_type,
      vat_number:         form.vat_number.trim() || null,
    }

    // I dati del profilo vengono messi nei user_metadata di Supabase.
    // Dopo la verifica email useremo questi campi per popolare la tabella
    // `vendors` dalla pagina /accedi (o al primo accesso autenticato).
    let signUpError
    // emailRedirectTo -> /auth/callback: la route scambia il code PKCE
    // per una sessione vera, poi redirige a /accedi che porta al profilo
    // giusto in base al ruolo. Senza questo passaggio il link dell'email
    // atterra su una pagina senza sessione attiva.
    if (mode === 'password') {
      const { error } = await supabase.auth.signUp({
        email:    form.email.trim(),
        password: form.password,
        options: {
          data: profile,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      signUpError = error
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email: form.email.trim(),
        options: {
          data: profile,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      signUpError = error
    }

    setLoading(false)
    if (signUpError) {
      setError(signUpError.message || 'Errore durante la registrazione. Riprova.')
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
          <h1 className="text-xl font-medium text-stone-900">Controlla la tua email</h1>
          <p className="text-stone-500 text-sm mt-2">
            Ti abbiamo inviato un link a <span className="font-medium text-stone-700">{form.email}</span> per {mode === 'password' ? 'confermare l\u2019account' : 'accedere'}.
          </p>
          <p className="text-stone-400 text-xs mt-4">
            Non trovi la mail? Controlla lo spam o tra qualche minuto.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 text-sm px-4 py-2 rounded-lg text-white font-medium no-underline"
            style={{ background: '#BA7517' }}
          >
            Torna ai mercati
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-medium text-stone-900">Registrati come venditore</h1>
          <p className="text-stone-400 text-sm mt-1">
            Crea il tuo profilo per prenotare i posteggi
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          {/* Scelta metodo */}
          <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-lg mb-5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setMode('password')}
              className={`py-2 rounded-md transition-colors ${mode === 'password' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}
            >
              Email + password
            </button>
            <button
              type="button"
              onClick={() => setMode('magic')}
              className={`py-2 rounded-md transition-colors ${mode === 'magic' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}
            >
              Magic link
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Nome e cognome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Mario Rossi"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="mario@esempio.it"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Telefono *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="338 123 4567"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Tipo di merce principale *</label>
              <select
                value={form.primary_goods_type}
                onChange={e => set('primary_goods_type', e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 bg-white"
              >
                {GOODS_TYPES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Partita IVA (opzionale)</label>
              <input
                type="text"
                value={form.vat_number}
                onChange={e => set('vat_number', e.target.value)}
                placeholder="IT01234567890"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
              />
            </div>

            {mode === 'password' && (
              <>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Password * <span className="text-stone-400 font-normal">(min 10 caratteri, maiuscole, minuscole, numeri)</span></label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Conferma password *</label>
                  <input
                    type="password"
                    value={form.password_confirm}
                    onChange={e => set('password_confirm', e.target.value)}
                    className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </>
            )}

            {/* Consenso GDPR esplicito */}
            <label className="flex items-start gap-2 text-xs text-stone-600 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 accent-amber-600"
                required
              />
              <span>
                Ho letto la{' '}
                <Link href="/privacy" className="text-amber-700 underline" target="_blank">privacy policy</Link>
                {' '}e i{' '}
                <Link href="/termini" className="text-amber-700 underline" target="_blank">termini di servizio</Link>
                , e accetto il trattamento dei miei dati per la registrazione.
              </span>
            </label>

            {error && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !consent}
              className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: '#BA7517' }}
            >
              {loading ? 'Invio in corso...' : (mode === 'password' ? 'Registrati' : 'Ricevi link via email')}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-stone-500 mt-4">
          Hai già un account?{' '}
          <Link href="/accedi" className="text-amber-700 font-medium hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  )
}
