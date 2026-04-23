import Link from 'next/link'

export const metadata = {
  title: 'Cookie policy - Mercati Soresina',
  description: 'Informativa sui cookie utilizzati dal sito.',
}

const LAST_UPDATE = '17 aprile 2026'

export default function CookiePage() {
  return (
    <article className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-10 max-w-3xl mx-auto">
      <div className="text-xs text-stone-400 mb-2">Ultimo aggiornamento: {LAST_UPDATE}</div>
      <h1 className="text-2xl sm:text-3xl font-medium text-stone-900 mb-1">Cookie policy</h1>
      <p className="text-stone-500 text-sm mb-8">
        Informazioni sui cookie e tecnologie simili utilizzate da questo sito.
      </p>

      <Section title="Cosa sono i cookie">
        <p>
          I cookie sono piccoli file di testo che i siti visitati dall'utente
          inviano al suo terminale, dove vengono memorizzati per essere
          ritrasmessi agli stessi siti alla visita successiva.
        </p>
      </Section>

      <Section title="Cookie utilizzati da questo sito">
        <p>
          Questo sito utilizza <strong>solo cookie tecnici</strong> strettamente
          necessari al funzionamento del servizio. Non usiamo cookie di
          profilazione, analytics di terze parti, social plugin o strumenti
          pubblicitari.
        </p>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-2 px-3 font-medium text-stone-500">Nome</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Finalita'</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Durata</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-stone-100">
                <td className="py-2 px-3 font-mono text-stone-700">sb-*-auth-token</td>
                <td className="py-2 px-3">Mantiene la sessione di autenticazione del venditore (Supabase).</td>
                <td className="py-2 px-3">Sessione / 1 settimana</td>
              </tr>
              <tr className="border-b border-stone-100">
                <td className="py-2 px-3 font-mono text-stone-700">sb-*-auth-token-code-verifier</td>
                <td className="py-2 px-3">Supporto alla procedura di login via email.</td>
                <td className="py-2 px-3">Sessione</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-stone-700">mercati-cookie-ack</td>
                <td className="py-2 px-3">Ricorda che hai chiuso l'informativa cookie.</td>
                <td className="py-2 px-3">1 anno</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm mt-3 text-stone-500">
          Tutti i cookie elencati sono di <em>prima parte</em> (impostati
          direttamente da questo sito o dal fornitore di autenticazione Supabase).
        </p>
      </Section>

      <Section title="Consenso">
        <p>
          Ai sensi delle linee guida del Garante Privacy del 10 giugno 2021,
          <strong> per i cookie tecnici non e' richiesto il consenso preventivo</strong>.
          L'informativa e' comunque mostrata alla prima visita come trasparenza
          aggiuntiva. Se in futuro il sito aggiungera' strumenti di analytics
          o profilazione, verra' mostrato un banner con opzione esplicita di
          accettazione o rifiuto.
        </p>
      </Section>

      <Section title="Come disattivare i cookie">
        <p>
          Puoi bloccare o cancellare i cookie dalle impostazioni del tuo
          browser. Tieni presente che disabilitando i cookie tecnici non
          potrai effettuare il login e prenotare posteggi.
        </p>
      </Section>

      <div className="mt-10 pt-6 border-t border-stone-100 text-sm text-stone-500">
        Vedi anche: <Link href="/privacy" className="text-amber-700 underline">Privacy policy</Link>
        {' · '}
        <Link href="/termini" className="text-amber-700 underline">Termini e condizioni</Link>
      </div>
    </article>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-6 text-sm text-stone-700 leading-relaxed space-y-2">
      <h2 className="text-base font-medium text-stone-900 mt-6">{title}</h2>
      {children}
    </section>
  )
}
