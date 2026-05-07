export const metadata = {
  title: 'Informativa sulla Privacy | COhA',
  description: 'Informativa sul trattamento dei dati personali ai sensi del GDPR',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Informativa sulla Privacy</h1>
        <p className="text-sm text-gray-500 mb-10">Ultimo aggiornamento: Maggio 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">1. Titolare del Trattamento</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            Il Titolare del Trattamento dei dati personali è <strong>[RAGIONE SOCIALE / NOME E COGNOME DEL TITOLARE]</strong>,
            con sede in <strong>[INDIRIZZO]</strong>, P.IVA/C.F. <strong>[CODICE FISCALE/P.IVA]</strong>.
            Per qualsiasi richiesta relativa al trattamento dei tuoi dati personali, puoi contattarci all&apos;indirizzo
            e-mail: <strong>[EMAIL PRIVACY]</strong>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">2. Dati Personali Raccolti</h2>
          <p className="text-sm leading-relaxed text-gray-700 mb-3">
            COhA raccoglie i seguenti dati personali forniti direttamente dall&apos;utente:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li><strong>Dati identificativi:</strong> nome, cognome, indirizzo e-mail, numero di telefono (opzionale)</li>
            <li><strong>Dati accademici:</strong> università, corso di studi, anno di corso, media voti (GPA, in forma anonimizzata per fasce)</li>
            <li><strong>Dati di profilo:</strong> interessi, obiettivi professionali, lingue parlate, disponibilità a trasferirsi, livello di inglese, data di nascita</li>
            <li><strong>Contenuti generati:</strong> post, commenti, messaggi privati, foto profilo</li>
            <li><strong>Dati tecnici:</strong> indirizzo IP, dati di sessione, preferenze di notifica</li>
          </ul>
          <p className="text-sm leading-relaxed text-gray-700 mt-3">
            Se accedi tramite Google, riceviamo dal tuo account Google i dati che hai autorizzato a condividere
            (di norma: nome, cognome, indirizzo e-mail, foto profilo).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">3. Base Legale del Trattamento</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>
              <strong>Esecuzione del contratto (Art. 6(1)(b) GDPR):</strong> per la gestione dell&apos;account, la fornitura
              del servizio di matching e networking.
            </li>
            <li>
              <strong>Consenso (Art. 6(1)(a) GDPR):</strong> per la profilazione psicologica tramite questionario di
              onboarding (cluster tag), per l&apos;invio di comunicazioni di marketing (se applicabile).
            </li>
            <li>
              <strong>Legittimo interesse (Art. 6(1)(f) GDPR):</strong> per la sicurezza della piattaforma, il rilevamento
              di abusi e la prevenzione di frodi.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">4. Finalità del Trattamento</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>Creazione e gestione dell&apos;account utente</li>
            <li>Erogazione del servizio di matching con opportunità accademiche e professionali</li>
            <li>Funzionalità di social networking (post, commenti, messaggi, amicizie)</li>
            <li>Profilazione per il calcolo del &quot;cluster&quot; (tipo di personalità professionale)</li>
            <li>Invio di notifiche relative all&apos;attività sulla piattaforma</li>
            <li>Miglioramento del servizio tramite analisi anonimizzate</li>
            <li>Adempimento di obblighi legali</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">5. Profilazione Automatizzata (Art. 22 GDPR)</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            COhA utilizza un sistema automatizzato per calcolare il tuo &quot;profilo&quot; (cluster tag:
            Analista, Creativo, Leader, Imprenditore, Sociale, Explorer) basato sulle risposte al questionario di
            onboarding. Questo profilo influenza le opportunità che ti vengono suggerite. Hai il diritto di
            richiedere una revisione umana di tale classificazione e di opporti alla profilazione contattandoci
            all&apos;indirizzo indicato al punto 1.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">6. Conservazione dei Dati</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li><strong>Dati account:</strong> conservati finché l&apos;account è attivo; cancellati entro 30 giorni dalla richiesta di cancellazione</li>
            <li><strong>Messaggi privati:</strong> conservati per 2 anni dall&apos;ultimo messaggio, poi eliminati automaticamente</li>
            <li><strong>Post e commenti:</strong> conservati finché l&apos;utente li elimina o cancella l&apos;account</li>
            <li><strong>Richieste di amicizia rifiutate:</strong> eliminate automaticamente dopo 30 giorni</li>
            <li><strong>Codici di verifica e-mail:</strong> eliminati automaticamente dopo 10 minuti</li>
            <li><strong>Log di sicurezza:</strong> conservati per 90 giorni</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">7. Destinatari dei Dati (Responsabili del Trattamento)</h2>
          <p className="text-sm leading-relaxed text-gray-700 mb-3">
            I tuoi dati personali possono essere trasmessi ai seguenti fornitori di servizi, che agiscono come
            Responsabili del Trattamento ai sensi dell&apos;Art. 28 GDPR:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li><strong>Cloudflare Inc.</strong> (USA) — archiviazione di immagini caricate dagli utenti (avatar, foto post, immagini messaggi) tramite Cloudflare R2. Trasferimento verso paese terzo coperto da Clausole Contrattuali Standard (SCC). DPA incluso nei ToS di Cloudflare.</li>
            <li><strong>Cloudinary Inc.</strong> (USA) — ottimizzazione e trasformazione delle immagini (fallback). Trasferimento verso paese terzo coperto da Clausole Contrattuali Standard (SCC).</li>
            <li><strong>Google LLC</strong> (USA) — autenticazione OAuth. Trasferimento coperto da SCC/DPF.</li>
            <li><strong>Provider hosting</strong> — [NOME PROVIDER HOSTING] per l&apos;infrastruttura server.</li>
            <li><strong>SendGrid / Twilio</strong> (USA) — invio di e-mail transazionali. Trasferimento coperto da SCC.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">8. Cookie e Tecnologie di Tracciamento</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            COhA utilizza esclusivamente cookie tecnici essenziali per il funzionamento del servizio:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 mt-2">
            <li><strong>refreshToken</strong> (cookie HTTPOnly, durata 7 giorni): necessario per mantenere la sessione autenticata. Non richiede consenso in quanto essenziale.</li>
          </ul>
          <p className="text-sm leading-relaxed text-gray-700 mt-3">
            Non utilizziamo cookie di profilazione o di tracciamento di terze parti. Non utilizziamo Google Analytics
            o strumenti analitici basati su cookie.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">9. Minori</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            COhA è riservato a utenti di età pari o superiore a 18 anni. Non raccogliamo
            consapevolmente dati personali di soggetti di età inferiore a 18 anni. Se sei genitore o tutore
            e ritieni che tuo figlio minorenne abbia creato un account, ti invitiamo a contattarci immediatamente
            all&apos;indirizzo indicato al punto 1 per richiedere la cancellazione dei dati.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">10. I Tuoi Diritti (Artt. 15-22 GDPR)</h2>
          <p className="text-sm leading-relaxed text-gray-700 mb-3">
            Hai il diritto di:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li><strong>Accesso (Art. 15):</strong> ottenere conferma del trattamento e copia dei tuoi dati</li>
            <li><strong>Rettifica (Art. 16):</strong> correggere dati inesatti o incompleti</li>
            <li><strong>Cancellazione (Art. 17, &quot;diritto all&apos;oblio&quot;):</strong> richiedere la cancellazione dei tuoi dati (disponibile direttamente nelle impostazioni dell&apos;account)</li>
            <li><strong>Limitazione (Art. 18):</strong> richiedere la sospensione del trattamento</li>
            <li><strong>Portabilità (Art. 20):</strong> ricevere i tuoi dati in formato strutturato e leggibile da macchina</li>
            <li><strong>Opposizione (Art. 21):</strong> opporti al trattamento basato su legittimo interesse</li>
            <li><strong>Revoca del consenso:</strong> revocare in qualsiasi momento il consenso prestato, senza pregiudicare la liceità del trattamento precedente</li>
          </ul>
          <p className="text-sm leading-relaxed text-gray-700 mt-3">
            Per esercitare questi diritti, contattaci a <strong>[EMAIL PRIVACY]</strong>. Hai inoltre il diritto di
            proporre reclamo al Garante per la Protezione dei Dati Personali (www.garanteprivacy.it).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">11. Modifiche all&apos;Informativa</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            Ci riserviamo il diritto di aggiornare questa informativa. In caso di modifiche sostanziali,
            informeremo gli utenti tramite e-mail o notifica nella piattaforma con almeno 14 giorni di preavviso.
          </p>
        </section>
      </div>
    </div>
  );
}
