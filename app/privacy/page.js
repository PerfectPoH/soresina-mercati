import Link from 'next/link'

export const metadata = {
  title: 'Privacy policy - Mercati Soresina',
  description: 'Informativa sul trattamento dei dati personali ai sensi del GDPR.',
}

// Ultima revisione: aggiornare quando si cambia l'informativa.
const LAST_UPDATE = '17 aprile 2026'

export default function PrivacyPage() {
  return (
    <article className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-10 max-w-3xl mx-auto">
      <div className="text-xs text-stone-400 mb-2">Ultimo aggiornamento: {LAST_UPDATE}</div>
      <h1 className="text-2xl sm:text-3xl font-medium text-stone-900 mb-1">Informativa sulla privacy</h1>
      <p className="text-stone-500 text-sm mb-8">
        Trattamento dei dati personali ai sensi del Regolamento (UE) 2016/679 (GDPR)
        e del D.Lgs. 196/2003 (Codice Privacy).
      </p>

      <Section title="1. Titolare del trattamento">
        <p>
          Il titolare del trattamento e' <strong>Pro Loco Soresina</strong>,
          con sede in Soresina (CR). Per esercitare i tuoi diritti o per
          qualsiasi richiesta legata ai tuoi dati puoi contattarci
          all'indirizzo email <a className="text-amber-700 underline" href="mailto:privacy@prolocosoresina.it">privacy@prolocosoresina.it</a>.
        </p>
        <p className="text-xs text-stone-500 mt-2">
          (L'indirizzo email e' indicativo: aggiorna questo paragrafo con il
          contatto ufficiale della Pro Loco prima della pubblicazione.)
        </p>
      </Section>

      <Section title="2. Dati raccolti">
        <p>Per gestire la prenotazione dei posteggi raccogliamo:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Nome e cognome</strong> del venditore</li>
          <li><strong>Email</strong> (per autenticazione e comunicazioni)</li>
          <li><strong>Numero di telefono</strong> (per contatti urgenti, es. annullamento mercato)</li>
          <li><strong>Tipo di merce venduta</strong> (per composizione del mercato)</li>
          <li><strong>Partita IVA</strong> (opzionale, per venditori con attivita' regolare)</li>
          <li><strong>Data e ora delle prenotazioni effettuate</strong></li>
          <li><strong>Indirizzo IP</strong> (temporaneamente, solo per rate limiting e log di sicurezza)</li>
        </ul>
      </Section>

      <Section title="3. Finalita' e base giuridica">
        <p>I dati vengono trattati per:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            <strong>Gestire le prenotazioni</strong> dei posteggi ai mercati organizzati
            dalla Pro Loco (base giuridica: esecuzione del contratto, art. 6.1.b GDPR);
          </li>
          <li>
            <strong>Contattare il venditore</strong> in caso di cambio data, annullamento
            o comunicazioni di servizio (base giuridica: esecuzione del contratto);
          </li>
          <li>
            <strong>Sicurezza del sistema</strong>: rilevare abusi, log di accesso,
            rate limiting (base giuridica: legittimo interesse, art. 6.1.f GDPR);
          </li>
          <li>
            <strong>Adempimenti fiscali/amministrativi</strong> eventualmente previsti
            dalla normativa (base giuridica: obbligo legale, art. 6.1.c GDPR).
          </li>
        </ul>
        <p className="text-sm mt-2">
          Non usiamo i tuoi dati per profilazione, pubblicita' o invio di
          newsletter commerciali. Non vendiamo dati a terzi.
        </p>
      </Section>

      <Section title="4. Dove sono conservati (destinatari)">
        <p>
          I dati sono conservati sui server di <strong>Supabase</strong> (PostgreSQL gestito)
          e il sito e' ospitato da <strong>Vercel</strong>. Entrambi i fornitori sono
          designati <em>responsabili del trattamento</em> ai sensi dell'art. 28 GDPR
          e possono trattare dati sia in UE che negli Stati Uniti, con garanzie
          adeguate (Standard Contractual Clauses).
        </p>
        <p className="text-sm mt-2">
          Nessun altro soggetto riceve i dati, salvo pubbliche autorita' su
          richiesta dell'autorita' competente.
        </p>
      </Section>

      <Section title="5. Per quanto tempo conserviamo i dati">
        <p>
          I dati di prenotazione vengono conservati per <strong>24 mesi</strong>
          dall'ultimo evento prenotato, per consentire statistiche di
          partecipazione e continuita' di servizio ai venditori abituali.
          Trascorso questo periodo, le prenotazioni vengono anonimizzate:
          il riferimento al venditore viene rimosso, resta solo il dato
          aggregato (data, tipo di merce) per fini statistici.
        </p>
        <p className="text-sm mt-2">
          Il profilo venditore resta attivo finche' non richiedi la cancellazione
          (vedi punto 6). I log di sicurezza (IP, timestamp) vengono mantenuti
          per massimo 30 giorni.
        </p>
      </Section>

      <Section title="6. I tuoi diritti">
        <p>
          In ogni momento puoi esercitare i diritti previsti dagli articoli
          15-22 del GDPR:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Accesso</strong> ai dati che ti riguardano;</li>
          <li><strong>Rettifica</strong> dei dati inesatti (dall'area personale);</li>
          <li><strong>Cancellazione</strong> ("diritto all'oblio"): puoi cancellare
              l'account dalla tua area personale, oppure scriverci a
              <a className="text-amber-700 underline" href="mailto:privacy@prolocosoresina.it"> privacy@prolocosoresina.it</a>;</li>
          <li><strong>Limitazione</strong> o <strong>opposizione</strong> al trattamento;</li>
          <li><strong>Portabilita'</strong>: esportazione dei tuoi dati in formato
              leggibile (JSON, su richiesta);</li>
          <li><strong>Reclamo</strong> all'autorita' Garante per la Protezione dei
              Dati Personali (<a className="text-amber-700 underline" href="https://www.garanteprivacy.it">garanteprivacy.it</a>).</li>
        </ul>
      </Section>

      <Section title="7. Cookie">
        <p>
          Il sito utilizza solo cookie <strong>tecnici</strong> necessari al
          funzionamento dell'autenticazione (gestiti da Supabase). Non usiamo
          cookie di profilazione, analytics o di terze parti a scopo
          pubblicitario. Per questo non e' richiesto il consenso preventivo
          ai sensi delle linee guida del Garante Privacy del 10 giugno 2021.
        </p>
      </Section>

      <Section title="8. Minori">
        <p>
          Il servizio e' destinato a venditori maggiorenni o alle persone fisiche
          autorizzate a rappresentare una attivita' commerciale. Non raccogliamo
          consapevolmente dati di minori di 16 anni.
        </p>
      </Section>

      <Section title="9. Modifiche all'informativa">
        <p>
          Possiamo aggiornare questa informativa per riflettere cambiamenti
          tecnici o normativi. La data di ultima revisione e' riportata in
          cima. Eventuali modifiche sostanziali verranno comunicate via email
          agli utenti registrati.
        </p>
      </Section>

      <div className="mt-10 pt-6 border-t border-stone-100 text-sm text-stone-500">
        Vedi anche: <Link href="/termini" className="text-amber-700 underline">Termini e condizioni</Link>
        {' · '}
        <Link href="/cookie" className="text-amber-700 underline">Cookie policy</Link>
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
