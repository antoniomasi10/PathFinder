import Link from 'next/link';

export const metadata = {
  title: 'Termini di Servizio — Pathfinder',
  description: 'Termini e condizioni di utilizzo della piattaforma Pathfinder.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/register" className="text-primary text-sm hover:underline">← Torna alla registrazione</Link>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Termini di Servizio</h1>
        <p className="text-text-secondary text-sm mb-8">Ultimo aggiornamento: 29 aprile 2026</p>

        <div className="space-y-8 text-text-secondary leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">1. Accettazione dei termini</h2>
            <p>
              Utilizzando la piattaforma <strong className="text-text-primary">Pathfinder</strong> accetti integralmente i presenti Termini di Servizio
              e la nostra <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
              Se non accetti questi termini, non puoi utilizzare il servizio.
              Pathfinder è riservato a studenti universitari iscritti presso università italiane.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">2. Descrizione del servizio</h2>
            <p>
              Pathfinder è una piattaforma di networking per studenti universitari italiani che offre:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>Matching personalizzato con opportunità accademiche e professionali.</li>
              <li>Funzionalità social: post, commenti, reazioni, connessioni con altri studenti.</li>
              <li>Messaggistica in tempo reale tra utenti connessi.</li>
              <li>Simulazioni di ammissione e strumenti di orientamento accademico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">3. Requisiti e registrazione</h2>
            <p className="mb-3">Per registrarti devi:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Avere almeno 16 anni di età.</li>
              <li>Essere uno studente universitario iscritto presso un ateneo italiano.</li>
              <li>Fornire informazioni accurate e veritiere durante la registrazione.</li>
              <li>Mantenere la riservatezza delle tue credenziali di accesso.</li>
            </ul>
            <p className="mt-3">
              Sei responsabile di tutte le attività eseguite tramite il tuo account. In caso di accesso non autorizzato,
              contattaci immediatamente a <a href="mailto:support@pathfinder.it" className="text-primary hover:underline">support@pathfinder.it</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">4. Comportamento degli utenti</h2>
            <p className="mb-3">Utilizzando Pathfinder ti impegni a non:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Pubblicare contenuti falsi, diffamatori, offensivi, discriminatori o illegali.</li>
              <li>Impersonare altre persone o enti.</li>
              <li>Utilizzare la piattaforma per spam, phishing o attività commerciali non autorizzate.</li>
              <li>Raccogliere dati personali di altri utenti senza consenso.</li>
              <li>Tentare di compromettere la sicurezza o l&apos;integrità della piattaforma.</li>
              <li>Aggirare eventuali misure di sicurezza o restrizioni tecniche.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">5. Contenuti degli utenti</h2>
            <p>
              Mantenendo la proprietà intellettuale dei contenuti che pubblichi, ci concedi una licenza non esclusiva,
              mondiale e gratuita per visualizzare, distribuire e promuovere tali contenuti nell&apos;ambito del servizio.
              Sei l&apos;unico responsabile dei contenuti che pubblichi e delle eventuali violazioni di diritti di terzi.
              Ci riserviamo il diritto di rimuovere contenuti che violano questi termini senza preavviso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">6. Proprietà intellettuale</h2>
            <p>
              Il marchio, il logo, il design, il codice sorgente e tutti i contenuti originali di Pathfinder sono di
              nostra esclusiva proprietà e sono protetti dalle leggi sul diritto d&apos;autore e sulla proprietà intellettuale.
              Non è consentito copiare, modificare, distribuire o creare opere derivate senza autorizzazione scritta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">7. Limitazione di responsabilità</h2>
            <p>
              Pathfinder è fornito &quot;così com&apos;è&quot; senza garanzie di alcun tipo. Non siamo responsabili per:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>Interruzioni del servizio o perdita di dati dovute a cause tecniche.</li>
              <li>Contenuti pubblicati dagli utenti.</li>
              <li>Decisioni prese dagli utenti sulla base delle informazioni presenti sulla piattaforma.</li>
              <li>Danni indiretti, incidentali o consequenziali derivanti dall&apos;uso del servizio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">8. Sospensione e chiusura dell&apos;account</h2>
            <p>
              Ci riserviamo il diritto di sospendere o chiudere il tuo account in caso di violazione di questi termini,
              previo avviso ove possibile. Puoi eliminare il tuo account in qualsiasi momento dalle impostazioni del profilo.
              In seguito alla cancellazione, i tuoi dati saranno eliminati entro 30 giorni come previsto dalla nostra Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">9. Modifiche ai termini</h2>
            <p>
              Potremmo aggiornare questi termini periodicamente. In caso di modifiche sostanziali ti informeremo
              tramite notifica nella piattaforma o via email con almeno 15 giorni di preavviso.
              L&apos;utilizzo continuato del servizio dopo la notifica costituisce accettazione dei nuovi termini.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">10. Legge applicabile</h2>
            <p>
              I presenti termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà competente
              in via esclusiva il Foro di Milano, salvo diverse disposizioni di legge a tutela del consumatore.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">11. Contatti</h2>
            <p>
              Per qualsiasi domanda relativa ai presenti termini, scrivi a{' '}
              <a href="mailto:legal@pathfinder.it" className="text-primary hover:underline">legal@pathfinder.it</a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <Link href="/register" className="btn-primary">Torna alla registrazione</Link>
        </div>
      </div>
    </div>
  );
}
