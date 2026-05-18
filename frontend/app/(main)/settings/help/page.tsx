'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/language';
import api from '@/lib/api';
import { ChevronLeft, ChevronRight, CircleHelp, Mail, TriangleWarning, FileText, ShieldCheck, CloseLg } from '@/components/icons';

type SubSheet = 'faq' | 'contact' | 'report' | 'terms' | 'privacy' | null;

const FAQ_ITEMS = [
  {
    q: "Come viene calcolato il punteggio di affinità con un'opportunità?",
    a: "Il punteggio di affinità è calcolato da un algoritmo che analizza diversi fattori del tuo profilo: le competenze che hai inserito, il tuo corso di laurea, l'università che frequenti e l'anno accademico. L'algoritmo confronta questi dati con i requisiti dell'opportunità e restituisce una percentuale di compatibilità. Più il tuo profilo è completo e aggiornato, più il punteggio sarà accurato e le opportunità mostrate in \"Per te\" saranno rilevanti per te.",
  },
  {
    q: 'Posso candidarmi direttamente da COhA?',
    a: 'Al momento COhA non gestisce direttamente le candidature. La nostra funzione è quella di metterti in contatto con le opportunità più adatte a te. Una volta trovata quella giusta, puoi accedere alla pagina ufficiale dell\'opportunità tramite il tasto "Vai all\'opportunità", dove potrai completare la candidatura secondo le modalità previste dall\'azienda o dall\'ente che la pubblica.',
  },
  {
    q: 'Cosa succede alle mie conversazioni se rimuovo un Pathmate?',
    a: "Se rimuovi un Pathmate, la cronologia dei messaggi precedenti rimane visibile per entrambi, ma non sarà più possibile inviare nuovi messaggi finché non tornate ad essere Pathmates. Inoltre, se nelle tue impostazioni privacy hai configurato alcune sezioni del profilo come visibili solo ai Pathmates, quell'utente perderà automaticamente l'accesso a quelle informazioni nel momento in cui viene rimosso.",
  },
  {
    q: 'Se imposto il profilo privato, i miei Pathmates attuali perdono accesso alle mie informazioni?',
    a: "No, attivare il profilo privato non influisce sulla visibilità verso i tuoi Pathmates attuali. Loro continueranno a vedere tutte le informazioni del tuo profilo come prima. Il profilo privato agisce esclusivamente verso gli utenti che non sono tuoi Pathmates: questi ultimi non potranno vedere competenze, università, opportunità salvate e lista dei Pathmates finché non li aggiungi.",
  },
  {
    q: 'Le opportunità salvate sono visibili alle aziende?',
    a: "No, le aziende non hanno accesso alla lista delle opportunità che hai salvato. I salvati sono una funzione personale pensata per aiutarti a tenere traccia delle opportunità che ti interessano. Puoi scegliere nelle impostazioni privacy se renderli visibili a tutti, solo ai tuoi Pathmates o a nessuno, ma in ogni caso le aziende che pubblicano le opportunità non ricevono alcuna notifica né hanno accesso a questi dati.",
  },
];

const TERMS_SECTIONS = [
  { title: 'Accettazione dei termini', body: 'Utilizzando COhA accetti integralmente i presenti Termini di Servizio. Se non accetti, ti preghiamo di non utilizzare la piattaforma. COhA è riservato a studenti universitari maggiorenni residenti in Italia. La registrazione implica la piena accettazione di questi termini.' },
  { title: 'Utilizzo del servizio', body: 'COhA è una piattaforma di networking universitario. Puoi utilizzarla per scoprire opportunità (tirocini, borse di studio, Erasmus, progetti, eventi), connetterti con altri studenti (Pathmates) e ricevere suggerimenti personalizzati. È vietato usare il servizio per attività illecite, per inviare spam o per raccogliere dati di altri utenti senza consenso.' },
  { title: 'Contenuti degli utenti', body: "I contenuti che pubblichi su COhA (post, commenti, messaggi) restano di tua proprietà. Concedi tuttavia a COhA una licenza non esclusiva per visualizzarli e distribuirli all'interno della piattaforma. È vietato pubblicare contenuti illegali, offensivi, discriminatori o che violino diritti di terzi. Ci riserviamo il diritto di rimuovere contenuti che violino queste regole." },
  { title: 'Privacy', body: "La raccolta e il trattamento dei tuoi dati personali sono regolati dall'Informativa sulla Privacy, che ti invitiamo a leggere. Utilizziamo i tuoi dati esclusivamente per fornire e migliorare il servizio, nel rispetto del GDPR (Reg. UE 2016/679) e della normativa italiana vigente." },
  { title: 'Limitazioni di responsabilità', body: "COhA non garantisce la disponibilità continua del servizio né l'accuratezza delle informazioni sulle opportunità pubblicate. Non siamo responsabili per danni diretti o indiretti derivanti dall'utilizzo della piattaforma, dalla partecipazione a opportunità trovate tramite essa, o da contenuti pubblicati da altri utenti." },
  { title: 'Modifiche ai termini', body: "Ci riserviamo il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche saranno comunicate tramite notifica nell'app con almeno 7 giorni di preavviso. L'utilizzo continuato della piattaforma dopo le modifiche costituisce accettazione dei nuovi Termini. In caso di disaccordo, puoi cancellare il tuo account." },
];

const PRIVACY_SECTIONS = [
  { title: 'Dati raccolti', body: "Raccogliamo i dati che fornisci durante la registrazione (nome, email, università, corso di laurea, anno accademico) e quelli del profilo accademico inseriti nell'onboarding (interessi, competenze, livello di inglese, disponibilità a trasferirsi). Registriamo inoltre le tue interazioni con la piattaforma (opportunità salvate, post, commenti, messaggi) e dati tecnici anonimi di navigazione." },
  { title: 'Come usiamo i tuoi dati', body: "I tuoi dati sono utilizzati per: fornire il servizio di matching personalizzato con opportunità accademiche e professionali; abilitare il networking con altri studenti (Pathmates); inviare notifiche sull'attività nella piattaforma; migliorare l'algoritmo di raccomandazione; garantire la sicurezza degli account e prevenire comportamenti abusivi." },
  { title: 'Condivisione dei dati', body: "Non vendiamo i tuoi dati a terzi. Il tuo profilo è visibile ad altri utenti COhA secondo le impostazioni di privacy da te scelte. Utilizziamo fornitori tecnici (hosting, analytics) vincolati da accordi di riservatezza che trattano i dati esclusivamente per conto nostro. Non condividiamo dati con le aziende che pubblicano opportunità." },
  { title: 'Sicurezza', body: "Adottiamo misure tecniche e organizzative adeguate per proteggere i tuoi dati da accessi non autorizzati, perdita o divulgazione. Le password sono conservate in forma cifrata. Le comunicazioni tra app e server avvengono tramite connessione crittografata (HTTPS). In caso di violazione dei dati ti informeremo entro 72 ore." },
  { title: 'I tuoi diritti', body: "Ai sensi del GDPR hai diritto di: accedere ai tuoi dati, rettificarli o cancellarli; limitare od opporti al trattamento; portabilità dei dati; revocare il consenso in qualsiasi momento. Puoi esercitare questi diritti scrivendo a info@cohaapp.com. Hai inoltre il diritto di presentare reclamo al Garante per la Protezione dei Dati Personali (www.garanteprivacy.it)." },
  { title: 'Contatti', body: "Il titolare del trattamento è COhA S.r.l. Per qualsiasi domanda sulla presente Informativa o per esercitare i tuoi diritti, contattaci a info@cohaapp.com. Risponderemo entro 30 giorni dalla ricezione della tua richiesta." },
];

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <CloseLg size={20} color="#595e78" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {children}
        </div>
      </div>
    </>
  );
}

export default function HelpPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [subSheet, setSubSheet] = useState<SubSheet>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const iconWrap = 'w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0';

  const items = [
    { key: 'faq' as SubSheet, icon: <CircleHelp size={20} color="#615fe2" />, label: t.help.helpCenter, desc: t.help.browseFaq },
    { key: 'contact' as SubSheet, icon: <Mail size={20} color="#615fe2" />, label: t.help.contactUs, desc: t.help.writeForHelp },
    { key: 'report' as SubSheet, icon: <TriangleWarning size={20} color="#615fe2" />, label: t.help.reportProblem, desc: undefined },
    { key: 'terms' as SubSheet, icon: <FileText size={20} color="#615fe2" />, label: t.help.termsOfService, desc: undefined },
    { key: 'privacy' as SubSheet, icon: <ShieldCheck size={20} color="#615fe2" />, label: t.help.privacyPolicy, desc: undefined },
  ];

  return (
    <div className="min-h-screen bg-[#fbf8ff] pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(172,176,206,0.3)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#615fe2]" aria-label="Indietro">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[#2c3149] font-bold text-lg">{t.help.title}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)]">
          {items.map((item, i) => (
            <div key={String(item.key)}>
              <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[rgba(172,176,206,0.08)] transition-colors" onClick={() => setSubSheet(item.key)}>
                <div className="flex items-center gap-3">
                  <div className={iconWrap}>{item.icon}</div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm text-[#2c3149]">{item.label}</span>
                    {item.desc && <span className="text-xs text-[#747995]">{item.desc}</span>}
                  </div>
                </div>
                <ChevronRight size={16} color="#747995" />
              </button>
              {i < items.length - 1 && <div className="ml-[60px] mr-2 h-px bg-[rgba(172,176,206,0.2)]" />}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Sheet */}
      <Sheet open={subSheet === 'faq'} onClose={() => setSubSheet(null)} title="Centro assistenza">
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)]">
              <button
                className="w-full flex items-center justify-between px-4 py-4 text-left gap-3"
                onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
              >
                <span className="text-sm text-[#2c3149] font-medium leading-snug">{item.q}</span>
                <svg className={`w-5 h-5 text-[#747995] flex-shrink-0 transition-transform duration-200 ${openFaqIndex === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaqIndex === i && (
                <div className="px-4 pb-4 text-sm text-[#595e78] leading-relaxed border-t border-[rgba(172,176,206,0.2)] pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </Sheet>

      {/* Contattaci Sheet */}
      <Sheet open={subSheet === 'contact'} onClose={() => setSubSheet(null)} title={t.help.contactUs}>
        <div className="space-y-4">
          <p className="text-sm text-[#595e78] leading-relaxed">Hai bisogno di aiuto? Il nostro team è disponibile per supportarti.</p>
          <div className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)]">
            <a href="mailto:info@cohaapp.com" className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(172,176,206,0.08)] transition-colors">
              <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#615fe2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#747995] font-medium">Email</p>
                <p className="text-sm text-[#615fe2] font-medium truncate">info@cohaapp.com</p>
              </div>
            </a>
            <div className="mx-4 h-px bg-[rgba(172,176,206,0.2)]" />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[22%] bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-[#747995] font-medium">Disponibilità</p>
                <p className="text-sm text-[#2c3149]">Lun–Ven, 9:00–18:00</p>
              </div>
            </div>
          </div>
          {contactSent ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[#2c3149] font-semibold text-base">Messaggio inviato</p>
              <p className="text-[#595e78] text-sm text-center leading-relaxed">Ti risponderemo all'indirizzo email associato al tuo account entro 48 ore lavorative.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 space-y-4 border border-[rgba(172,176,206,0.3)]">
                <div>
                  <label className="text-xs text-[#747995] font-medium uppercase tracking-wider block mb-2">Oggetto</label>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={e => setContactSubject(e.target.value)}
                    placeholder="Di cosa hai bisogno?"
                    className="w-full bg-[#fbf8ff] text-sm text-[#2c3149] placeholder-[#acb0ce] rounded-xl px-4 py-3 border border-[rgba(172,176,206,0.3)] focus:outline-none focus:border-[#615fe2]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#747995] font-medium uppercase tracking-wider block mb-2">Messaggio</label>
                  <textarea
                    value={contactMessage}
                    onChange={e => setContactMessage(e.target.value)}
                    placeholder="Descrivi la tua richiesta nel dettaglio..."
                    rows={5}
                    className="w-full bg-[#fbf8ff] text-sm text-[#2c3149] placeholder-[#acb0ce] rounded-xl px-4 py-3 border border-[rgba(172,176,206,0.3)] focus:outline-none focus:border-[#615fe2] resize-none"
                  />
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!contactSubject.trim() || !contactMessage.trim()) return;
                  try { await api.post('/support/contact', { subject: contactSubject, message: contactMessage }); } catch {}
                  setContactSent(true);
                }}
                disabled={!contactSubject.trim() || !contactMessage.trim()}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-[#615fe2] text-white hover:bg-[#4a4bd7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Invia
              </button>
            </div>
          )}
        </div>
      </Sheet>

      {/* Segnala Sheet */}
      <Sheet open={subSheet === 'report'} onClose={() => setSubSheet(null)} title={t.help.reportProblem}>
        {reportSent ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[#2c3149] font-semibold text-base">Segnalazione inviata</p>
            <p className="text-[#595e78] text-sm text-center">Grazie per il tuo feedback.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 space-y-4 border border-[rgba(172,176,206,0.3)]">
              <div>
                <label className="text-xs text-[#747995] font-medium uppercase tracking-wider block mb-2">Categoria</label>
                <div className="relative">
                  <select
                    value={reportCategory}
                    onChange={e => setReportCategory(e.target.value)}
                    className="w-full appearance-none bg-[#fbf8ff] text-sm text-[#2c3149] rounded-xl px-4 py-3 border border-[rgba(172,176,206,0.3)] focus:outline-none focus:border-[#615fe2] pr-10"
                  >
                    <option value="" disabled>Seleziona una categoria...</option>
                    <option value="bug">Bug tecnico</option>
                    <option value="content">Contenuto inappropriato</option>
                    <option value="user">Problema con un utente</option>
                    <option value="other">Altro</option>
                  </select>
                  <svg className="w-4 h-4 text-[#747995] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#747995] font-medium uppercase tracking-wider block mb-2">Descrizione</label>
                <textarea
                  value={reportDescription}
                  onChange={e => setReportDescription(e.target.value)}
                  placeholder="Descrivi il problema nel dettaglio..."
                  rows={4}
                  className="w-full bg-[#fbf8ff] text-sm text-[#2c3149] placeholder-[#acb0ce] rounded-xl px-4 py-3 border border-[rgba(172,176,206,0.3)] focus:outline-none focus:border-[#615fe2] resize-none"
                />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!reportCategory || !reportDescription.trim()) return;
                try { await api.post('/support/report', { category: reportCategory, description: reportDescription }); } catch {}
                setReportSent(true);
              }}
              disabled={!reportCategory || !reportDescription.trim()}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-[#615fe2] text-white hover:bg-[#4a4bd7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Invia segnalazione
            </button>
          </div>
        )}
      </Sheet>

      {/* Termini Sheet */}
      <Sheet open={subSheet === 'terms'} onClose={() => setSubSheet(null)} title={t.help.termsOfService}>
        <div className="space-y-4 text-sm text-[#595e78] leading-relaxed">
          <p className="text-xs text-[#acb0ce]">Ultimo aggiornamento: gennaio 2025</p>
          {TERMS_SECTIONS.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 space-y-2 border border-[rgba(172,176,206,0.3)]">
              <h3 className="text-[#2c3149] font-semibold text-sm">{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </Sheet>

      {/* Privacy Sheet */}
      <Sheet open={subSheet === 'privacy'} onClose={() => setSubSheet(null)} title={t.help.privacyPolicy}>
        <div className="space-y-4 text-sm text-[#595e78] leading-relaxed">
          <p className="text-xs text-[#acb0ce]">Ultimo aggiornamento: gennaio 2025 · Conforme al GDPR (Reg. UE 2016/679)</p>
          {PRIVACY_SECTIONS.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 space-y-2 border border-[rgba(172,176,206,0.3)]">
              <h3 className="text-[#2c3149] font-semibold text-sm">{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
