import Link from 'next/link'

export const metadata = {
  title: 'Termini e condizioni - Mercati Soresina',
  description: 'Termini e condizioni di utilizzo del servizio di prenotazione posteggi.',
}

const LAST_UPDATE = '17 aprile 2026'

export default function TerminiPage() {
  return (
    <article className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-10 max-w-3xl mx-auto">
      <div className="text-xs text-stone-400 mb-2">Ultimo aggiornamento: {LAST_UPDATE}</div>
      <h1 className="text-2xl sm:text-3xl font-medium text-stone-900 mb-1">Termini e condizioni</h1>
      <p className="text-stone-500 text-sm mb-8">
        Condizioni di utilizzo del servizio di prenotazione posteggi ai mercati
        organizzati dalla Pro Loco Soresina.
      </p>

      <Section title="1. Oggetto del servizio">
        <p>
          Il sito <strong>mercati-soresina</strong> (di seguito: "il Servizio") permette
          ai venditori ambulanti di prenotare online un posteggio per i mercati
          organizzati dalla Pro Loco Soresina. Il Servizio e' gratuito per quanto
          riguarda l'utilizzo della piattaforma; il costo del posteggio e'
          indicato per ciascun evento.
        </p>
      </Section>

      <Section title="2. Registrazione e profilo venditore">
        <p>
          Per prenotare e' necessario registrare un account con nome, email
          valida e numero di telefono reale. Dichiari di essere maggiorenne e di
          fornire dati veritieri. La Pro Loco puo' sospendere o cancellare
          account che risultano fittizi o usati in modo scorretto
          (es. occupazione di posteggi senza presentarsi).
        </p>
      </Section>

      <Section title="3. Prenotazione di un posteggio">
        <p>
          Puoi prenotare fino a <strong>2 posteggi</strong> per ogni evento.
          La prenotazione e' immediata: una volta confermata, il posteggio
          scelto risulta impegnato per te e per nessun altro. Non c'e' pagamento
          online: il saldo avviene come da tradizione in fiera, il giorno
          dell'evento, all'incaricato della Pro Loco.
        </p>
      </Section>

      <Section title="4. Cancellazione e rinuncia">
        <p>
          Puoi cancellare la prenotazione fino a <strong>48 ore</strong> prima
          dell'evento, direttamente dalla tua area personale, senza penali.
          Cancellazioni last-minute (meno di 48 ore) sono a discrezione della
          Pro Loco: in caso di ripetute rinunce non giustificate, il tuo
          account puo' essere limitato.
        </p>
      </Section>

      <Section title="5. Annullamento del mercato">
        <p>
          In caso di <strong>maltempo</strong>, disposizione delle autorita',
          forza maggiore o altre ragioni organizzative, il mercato puo' essere
          annullato o rinviato. La comunicazione avverra' via email o SMS al
          contatto indicato nel profilo, con il maggiore preavviso possibile.
        </p>
        <p className="text-sm mt-2">
          In caso di annullamento:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Nessun costo e' dovuto se il posteggio non e' stato allestito.</li>
          <li>Se il mercato viene rinviato, la tua prenotazione viene spostata
              alla nuova data, salvo tua comunicazione contraria.</li>
          <li>Se il pagamento e' gia' avvenuto in loco, si procede al rimborso
              o al credito sulla prenotazione successiva, a scelta del venditore.</li>
        </ul>
      </Section>

      <Section title="6. Responsabilita'">
        <p>
          Il venditore e' responsabile della merce esposta, della sicurezza
          del proprio banco, del rispetto delle norme igienico-sanitarie e
          fiscali applicabili alla sua attivita'. La Pro Loco Soresina non
          risponde di furti, danni a cose o persone causati dal venditore o
          subiti nell'area di mercato, salvo quanto previsto dalle leggi
          applicabili.
        </p>
      </Section>

      <Section title="7. Uso corretto della piattaforma">
        <p>Non e' consentito:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Creare account falsi o con dati di terzi;</li>
          <li>Tentare di compromettere la sicurezza del sistema, fare scraping
              massivo o tentativi di accesso non autorizzato;</li>
          <li>Prenotare posteggi per rivenderli a terzi.</li>
        </ul>
        <p className="text-sm mt-2">
          Violazioni comportano la cancellazione immediata dell'account e,
          se necessario, segnalazione alle autorita'.
        </p>
      </Section>

      <Section title="8. Modifiche al servizio">
        <p>
          La Pro Loco puo' modificare caratteristiche, tariffe e modalita' di
          prenotazione dandone adeguato preavviso tramite il sito. Le modifiche
          non influiscono sulle prenotazioni gia' confermate.
        </p>
      </Section>

      <Section title="9. Privacy">
        <p>
          Il trattamento dei dati personali e' descritto nell'
          <Link href="/privacy" className="text-amber-700 underline">Informativa sulla privacy</Link>.
          Per esercitare i tuoi diritti o cancellare i tuoi dati scrivi a
          <a className="text-amber-700 underline" href="mailto:privacy@prolocosoresina.it"> privacy@prolocosoresina.it</a>.
        </p>
      </Section>

      <Section title="10. Legge applicabile e foro competente">
        <p>
          Questi termini sono regolati dalla legge italiana. Per ogni
          controversia relativa al Servizio e' competente il foro di residenza
          del consumatore, ove applicabile; in alternativa il foro di Cremona.
        </p>
      </Section>

      <div className="mt-10 pt-6 border-t border-stone-100 text-sm text-stone-500">
        Vedi anche: <Link href="/privacy" className="text-amber-700 underline">Privacy policy</Link>
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
