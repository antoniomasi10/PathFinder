import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Pathfinder',
  description: 'Informativa sul trattamento dei dati personali degli utenti di Pathfinder.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/register" className="text-primary text-sm hover:underline">← Torna alla registrazione</Link>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Privacy Policy</h1>
        <p className="text-text-secondary text-sm mb-8">Ultimo aggiornamento: 29 aprile 2026</p>

        <div className="space-y-8 text-text-secondary leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">1. Titolare del trattamento</h2>
            <p>
              Il titolare del trattamento dei dati personali è <strong className="text-text-primary">Pathfinder</strong>,
              raggiungibile all&apos;indirizzo email <a href="mailto:privacy@pathfinder.it" className="text-primary hover:underline">privacy@pathfinder.it</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">2. Dati raccolti</h2>
            <p className="mb-3">Raccogliamo le seguenti categorie di dati personali:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-text-primary">Dati di registrazione:</strong> nome, cognome, email, numero di telefono (opzionale), università, corso di studi.</li>
              <li><strong className="text-text-primary">Dati del profilo:</strong> anno di studio, GPA, livello di inglese, disponibilità alla mobilità, interessi, competenze, foto profilo, bio.</li>
              <li><strong className="text-text-primary">Dati di utilizzo:</strong> post, commenti, messaggi, opportunità salvate, interazioni con i contenuti.</li>
              <li><strong className="text-text-primary">Dati tecnici:</strong> indirizzo IP, log di accesso, informazioni sul dispositivo.</li>
              <li><strong className="text-text-primary">Dati di autenticazione Google</strong> (se usi il login con Google): email e foto profilo forniti da Google.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">3. Finalità e basi giuridiche del trattamento</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-text-primary">Esecuzione del contratto (Art. 6 par. 1 lett. b GDPR)</p>
                <p>Fornitura del servizio di networking, matching con opportunità, messaggistica e funzionalità social della piattaforma.</p>
              </div>
              <div>
                <p className="font-medium text-text-primary">Consenso (Art. 6 par. 1 lett. a GDPR)</p>
                <p>Invio di comunicazioni di marketing e newsletter, se hai fornito il consenso durante la registrazione.</p>
              </div>
              <div>
                <p className="font-medium text-text-primary">Interesse legittimo (Art. 6 par. 1 lett. f GDPR)</p>
                <p>Sicurezza della piattaforma, prevenzione delle frodi, analisi statistica aggregata per miglioramento del servizio.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">4. Conservazione dei dati</h2>
            <p>
              I dati vengono conservati per il tempo strettamente necessario all&apos;erogazione del servizio.
              In caso di cancellazione dell&apos;account, i dati personali vengono eliminati entro 30 giorni,
              salvo obblighi di conservazione previsti dalla legge.
              I log di sicurezza vengono conservati per un massimo di 12 mesi.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">5. Condivisione dei dati</h2>
            <p className="mb-3">I tuoi dati non vengono venduti a terzi. Possono essere condivisi con:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-text-primary">Fornitori di servizi tecnici</strong> (hosting, storage immagini, email transazionale) che agiscono come responsabili del trattamento.</li>
              <li><strong className="text-text-primary">Altri utenti della piattaforma</strong>, nei limiti delle impostazioni di privacy da te configurate.</li>
              <li><strong className="text-text-primary">Autorità competenti</strong>, nei casi previsti dalla legge.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">6. I tuoi diritti (GDPR Artt. 15–22)</h2>
            <p className="mb-3">Hai diritto a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-text-primary">Accesso</strong> — richiedere una copia dei tuoi dati personali.</li>
              <li><strong className="text-text-primary">Rettifica</strong> — correggere dati inesatti tramite le impostazioni del profilo.</li>
              <li><strong className="text-text-primary">Cancellazione</strong> — eliminare il tuo account e tutti i dati associati dalle impostazioni del profilo.</li>
              <li><strong className="text-text-primary">Portabilità</strong> — esportare i tuoi dati in formato JSON da <em>Impostazioni → Esporta dati</em>.</li>
              <li><strong className="text-text-primary">Opposizione</strong> — opporti al trattamento per finalità di marketing in qualsiasi momento.</li>
              <li><strong className="text-text-primary">Revoca del consenso</strong> — ritirare il consenso al marketing senza pregiudicare la liceità del trattamento precedente.</li>
            </ul>
            <p className="mt-3">
              Per esercitare questi diritti scrivi a{' '}
              <a href="mailto:privacy@pathfinder.it" className="text-primary hover:underline">privacy@pathfinder.it</a>.
              Hai anche diritto di proporre reclamo al Garante per la Protezione dei Dati Personali (<a href="https://www.garanteprivacy.it" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">garanteprivacy.it</a>).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">7. Cookie</h2>
            <p>
              Utilizziamo esclusivamente cookie tecnici necessari al funzionamento del servizio (autenticazione tramite cookie HTTPOnly).
              Non utilizziamo cookie di profilazione o di tracciamento di terze parti.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">8. Trasferimenti internazionali</h2>
            <p>
              I dati possono essere trasferiti verso paesi extra-UE (es. per lo storage su Cloudflare R2).
              Tali trasferimenti avvengono nel rispetto delle garanzie previste dal GDPR
              (Clausole Contrattuali Standard approvate dalla Commissione Europea).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">9. Modifiche alla Privacy Policy</h2>
            <p>
              Ci riserviamo di aggiornare questa informativa. In caso di modifiche sostanziali ti informeremo
              tramite notifica nella piattaforma o via email con almeno 15 giorni di preavviso.
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
