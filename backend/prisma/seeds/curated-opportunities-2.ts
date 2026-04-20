/**
 * Curated opportunities seed — round 2.
 *
 * Covers domains underserved after round 1:
 * medicine/health, humanities/social science, diplomacy, social entrepreneurship,
 * creative arts/design, Italian prestige programs, and more EVENT/CONFERENCE entries.
 *
 * Run: npx ts-node --transpile-only prisma/seeds/curated-opportunities-2.ts
 */
import { upsertManualOpportunity } from '../../src/services/import/manual.import';
import { logger } from '../../src/utils/logger';

const opportunities = [

  // ── FELLOWSHIPS — social impact & humanities ───────────────────────────────

  {
    title: 'Fulbright Foreign Student Program — USA',
    description: 'The Fulbright Program is the US government flagship international scholarship, funding postgraduate study and research in the United States for students from 160+ countries. Fully funded: tuition, living stipend, health insurance, and travel. Highly competitive (Italy: ~15 grants/year).',
    type: 'FELLOWSHIP' as const,
    url: 'https://fulbright.it/',
    organizer: 'U.S. Embassy Rome / Fulbright Commission',
    location: 'United States',
    country: 'US',
    isAbroad: true,
    isRemote: false,
    format: 'IN_PERSON' as const,
    cost: 0,
    hasScholarship: true,
    scholarshipDetails: 'Fully funded: tuition, stipend, health insurance, and round-trip travel.',
    eligibleFields: [] as any[],
    minYearOfStudy: 4,
    maxYearOfStudy: 6,
    tags: ['fellowship', 'fully-funded', 'usa', 'fulbright', 'postgraduate', 'research'],
    sourceId: 'curated-fulbright-italy',
  },

  {
    title: 'Obama Foundation Scholars Program — Columbia University',
    description: 'The Obama Foundation Scholars Program at Columbia University is a 1-year leadership program for emerging civic leaders aged 21–30. Fully funded. Focus on social change, community development, and public service. Applications open annually in early autumn.',
    type: 'FELLOWSHIP' as const,
    url: 'https://www.obama.org/programs/scholars/',
    organizer: 'Obama Foundation',
    location: 'New York, USA',
    city: 'New York',
    country: 'US',
    isAbroad: true,
    isRemote: false,
    format: 'IN_PERSON' as const,
    cost: 0,
    hasScholarship: true,
    scholarshipDetails: 'Fully funded: tuition, accommodation, stipend, and travel.',
    eligibleFields: ['POLITICAL_SCIENCE', 'HUMANITIES', 'EDUCATION'] as any[],
    minYearOfStudy: 3,
    maxYearOfStudy: 6,
    tags: ['fellowship', 'fully-funded', 'leadership', 'social-impact', 'usa', 'obama'],
    sourceId: 'curated-obama-scholars',
  },

  {
    title: 'Fondazione Cariplo — Young Investigator Grant (Italy)',
    description: 'Fondazione Cariplo finanzia progetti di ricerca scientifica per giovani ricercatori italiani under 40, con grants da €100.000 a €400.000 su aree: ricerca biomedica, scienze dell\'ambiente, e scienze sociali e umanistiche. Aperto a ricercatori con contratto presso istituti italiani.',
    type: 'FELLOWSHIP' as const,
    url: 'https://www.fondazionecariplo.it/it/programmi/ricerca/',
    organizer: 'Fondazione Cariplo',
    location: 'Italy',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    cost: 0,
    hasScholarship: true,
    scholarshipDetails: 'Grants €100.000–€400.000 per progetti di ricerca (2–3 anni).',
    stipend: 0,
    eligibleFields: ['MEDICINE', 'LIFE_SCIENCES', 'HUMANITIES', 'PHYSICAL_SCIENCES'] as any[],
    minYearOfStudy: 5,
    maxYearOfStudy: 6,
    tags: ['fellowship', 'research', 'grant', 'italy', 'cariplo', 'funded'],
    sourceId: 'curated-cariplo-young-investigator',
  },

  // ── SUMMER PROGRAMS — medicine & science ───────────────────────────────���──

  {
    title: 'NIH Summer Internship Program in Biomedical Research — USA',
    description: 'The NIH Summer Internship Program (SIP) places students in research labs at the National Institutes of Health in Bethesda, Maryland. 8–10 weeks, paid stipend ($1,800–$2,000/month). Open to undergraduate and graduate students in biomedical, behavioral, and social sciences.',
    type: 'SUMMER_PROGRAM' as const,
    url: 'https://www.training.nih.gov/programs/sip',
    organizer: 'National Institutes of Health (NIH)',
    location: 'Bethesda, USA',
    city: 'Bethesda',
    country: 'US',
    isAbroad: true,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 63,
    cost: 0,
    hasScholarship: true,
    scholarshipDetails: 'Paid stipend $1,800–$2,000/month. Housing assistance available.',
    stipend: 1800,
    eligibleFields: ['MEDICINE', 'LIFE_SCIENCES', 'PSYCHOLOGY', 'PHYSICAL_SCIENCES'] as any[],
    minYearOfStudy: 2,
    maxYearOfStudy: 5,
    tags: ['summer-program', 'research', 'medicine', 'biomedical', 'nih', 'usa', 'paid'],
    sourceId: 'curated-nih-sip',
  },

  {
    title: 'Scuola Normale Superiore — Summer School Pisa',
    description: 'La Scuola Normale Superiore di Pisa offre summer school in scienze umane, letteratura, filosofia, storia, e scienze esatte. Destinata a studenti universitari eccellenti. Borsa di studio totale disponibile per i migliori candidati. Lingua: italiano e inglese.',
    type: 'SUMMER_PROGRAM' as const,
    url: 'https://www.sns.it/it',
    organizer: 'Scuola Normale Superiore',
    location: 'Pisa, Italy',
    city: 'Pisa',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 14,
    cost: 0,
    hasScholarship: true,
    scholarshipDetails: 'Borse di studio totali (vitto, alloggio, rimborso viaggi) per studenti selezionati.',
    eligibleFields: ['HUMANITIES', 'MATHEMATICS', 'PHYSICAL_SCIENCES', 'LIFE_SCIENCES'] as any[],
    minYearOfStudy: 2,
    maxYearOfStudy: 5,
    tags: ['summer-school', 'humanities', 'sciences', 'pisa', 'sns', 'fully-funded', 'italy'],
    sourceId: 'curated-sns-summer-school',
  },

  // ── CONFERENCES & EVENTS ─────────────────────────────────────────────��────

  {
    title: 'European Youth Parliament — National Selection Italy',
    description: "L'European Youth Parliament (EYP) è una delle più grandi associazioni giovanili indipendenti d'Europa. Le sessioni nazionali italiane raccolgono 100+ studenti universitari per 3 giorni di dibattiti parlamentari su temi europei. Partecipazione gratuita, viaggio a carico del partecipante.",
    type: 'CONFERENCE' as const,
    url: 'https://eyp.it/',
    organizer: 'EYP Italia',
    location: 'Italy (rotates)',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 3,
    cost: 80,
    hasScholarship: false,
    eligibleFields: ['POLITICAL_SCIENCE', 'LAW', 'ECONOMICS', 'HUMANITIES'] as any[],
    minYearOfStudy: 1,
    maxYearOfStudy: 5,
    tags: ['conference', 'european', 'parliament', 'diplomacy', 'italy', 'eyp', 'networking'],
    sourceId: 'curated-eyp-italy',
  },

  {
    title: 'Startup Weekend — Italy (by Techstars)',
    description: 'Startup Weekend è un evento intensivo di 54 ore organizzato da Techstars in cui partecipanti con background diversi (sviluppatori, designer, marketer) formano team e costruiscono una startup dal concept al pitch. Costo ~€50-80. Si tiene in varie città italiane durante tutto l\'anno.',
    type: 'HACKATHON' as const,
    url: 'https://startupweekend.org/',
    organizer: 'Techstars',
    location: 'Italy (rotates)',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 3,
    cost: 65,
    hasScholarship: false,
    eligibleFields: ['BUSINESS', 'COMPUTER_SCIENCE', 'DESIGN'] as any[],
    minYearOfStudy: 1,
    maxYearOfStudy: 6,
    tags: ['hackathon', 'startup', 'entrepreneurship', 'italy', 'techstars', 'weekend'],
    sourceId: 'curated-startup-weekend-italy',
  },

  {
    title: 'Forum Economico di Trento (Festival dell\'Economia)',
    description: "Il Festival dell'Economia di Trento è uno dei principali eventi di divulgazione economica in Italia, con economisti, policy maker e imprenditori di fama internazionale. Ingresso gratuito per studenti universitari. Ideale per studenti di economia, scienze politiche e management.",
    type: 'CONFERENCE' as const,
    url: 'https://www.festivaleconomia.it/',
    organizer: 'Provincia Autonoma di Trento',
    location: 'Trento, Italy',
    city: 'Trento',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 4,
    cost: 0,
    hasScholarship: false,
    eligibleFields: ['ECONOMICS', 'BUSINESS', 'POLITICAL_SCIENCE'] as any[],
    minYearOfStudy: 1,
    maxYearOfStudy: 6,
    tags: ['conference', 'economics', 'trento', 'festival', 'italy', 'free'],
    sourceId: 'curated-festival-economia-trento',
  },

  // ── EXCHANGE / VOLUNTEERING ───────────────────────────────────────────────

  {
    title: 'AIESEC — International Volunteer Exchange Program',
    description: "AIESEC è la più grande organizzazione giovanile al mondo (113 paesi). Offre esperienze di volontariato internazionale da 6 a 8 settimane su progetti in educazione, ambiente, salute, e imprenditorialità. Costo di partecipazione variabile (€200–€1.200 a seconda del paese). Aperto a studenti universitari.",
    type: 'EXCHANGE' as const,
    url: 'https://aiesec.org/global-volunteer',
    organizer: 'AIESEC',
    isAbroad: true,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 49,
    cost: 500,
    hasScholarship: false,
    eligibleFields: [] as any[],
    minYearOfStudy: 1,
    maxYearOfStudy: 5,
    tags: ['exchange', 'volunteering', 'international', 'aiesec', 'social-impact'],
    sourceId: 'curated-aiesec-volunteer',
  },

  {
    title: 'Erasmus+ Blended Intensive Program (BIP)',
    description: 'I BIP Erasmus+ combinano una fase online con una mobilità fisica breve (5–30 giorni) presso università partner europee. Finanziati da Erasmus+, offrono un contributo giornaliero (€70–€150/giorno) per coprire soggiorno e viaggi. Disponibili in tutte le università italiane convenzionate.',
    type: 'EXCHANGE' as const,
    url: 'https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/studying-abroad',
    organizer: 'European Commission / Erasmus+',
    isAbroad: true,
    isRemote: false,
    format: 'HYBRID' as const,
    durationDays: 14,
    cost: 0,
    hasScholarship: true,
    scholarshipDetails: 'Erasmus+ grant: €70–150/giorno per la fase di mobilità fisica.',
    eligibleFields: [] as any[],
    minYearOfStudy: 2,
    maxYearOfStudy: 5,
    tags: ['exchange', 'erasmus', 'europe', 'funded', 'mobility', 'hybrid'],
    sourceId: 'curated-erasmus-bip',
  },

  // ── RESEARCH ──────────────────────────────────────────────────────────────

  {
    title: 'Istituto Italiano di Tecnologia (IIT) — Summer Student Program',
    description: "IIT offre internship di ricerca estivi a studenti magistrali e dottorali in: robotics, neuroscience, computational sciences, e materials science. Sede principale a Genova, con laboratori distribuiti in tutta Italia. Rimborso spese. Candidature tipicamente aperte da gennaio a marzo.",
    type: 'RESEARCH' as const,
    url: 'https://www.iit.it/web/careers/internships',
    organizer: 'Istituto Italiano di Tecnologia',
    location: 'Genoa, Italy',
    city: 'Genoa',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 56,
    cost: 0,
    hasScholarship: true,
    scholarshipDetails: 'Rimborso spese per internship di ricerca (importo variabile per sede).',
    eligibleFields: ['ENGINEERING', 'COMPUTER_SCIENCE', 'LIFE_SCIENCES', 'PHYSICAL_SCIENCES'] as any[],
    minYearOfStudy: 3,
    maxYearOfStudy: 6,
    tags: ['research', 'robotics', 'neuroscience', 'italy', 'iit', 'internship', 'tech'],
    sourceId: 'curated-iit-summer',
  },

  {
    title: 'CERN OpenLab Student Program — IT & Electronics',
    description: "CERN openlab offers a 2-month paid internship for IT/electronics students to work on cutting-edge computing challenges at CERN. Projects span: distributed computing, machine learning, data analytics, and hardware. Stipend CHF 91/day + accommodation. Applications open January–February.",
    type: 'RESEARCH' as const,
    url: 'https://openlab.cern/education/cern-openlab-summer-student-programme',
    organizer: 'CERN openlab',
    location: 'Geneva, Switzerland',
    city: 'Geneva',
    country: 'CH',
    isAbroad: true,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 56,
    cost: 0,
    hasScholarship: true,
    scholarshipDetails: 'Stipend CHF 91/day + free CERN hostel accommodation.',
    stipend: 91,
    eligibleFields: ['COMPUTER_SCIENCE', 'ENGINEERING', 'MATHEMATICS'] as any[],
    minYearOfStudy: 2,
    maxYearOfStudy: 5,
    tags: ['research', 'computing', 'cern', 'geneva', 'paid', 'it', 'openlab'],
    sourceId: 'curated-cern-openlab',
  },

  // ── COMPETITION ────────────────────────────────────────────────────────────

  {
    title: 'FameLab — International Science Communication Competition',
    description: "FameLab è una competizione internazionale di comunicazione scientifica: i partecipanti hanno 3 minuti per spiegare un concetto scientifico in modo chiaro e coinvolgente. Si tiene in 30+ paesi, con finali nazionali e internazionale a Cheltenham Science Festival (UK). Aperto a studenti e ricercatori under 35.",
    type: 'COMPETITION' as const,
    url: 'https://www.cheltenhamfestivals.com/famelab',
    organizer: 'Cheltenham Festivals / British Council',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 1,
    cost: 0,
    hasScholarship: false,
    eligibleFields: ['PHYSICAL_SCIENCES', 'LIFE_SCIENCES', 'MEDICINE', 'ENGINEERING', 'MATHEMATICS'] as any[],
    minYearOfStudy: 2,
    maxYearOfStudy: 6,
    tags: ['competition', 'science', 'communication', 'famelab', 'stem', 'public-speaking'],
    sourceId: 'curated-famelab',
  },

  {
    title: 'Hult Prize — Global Student Social Enterprise Competition',
    description: "The Hult Prize is the world's largest student competition for social good. Teams of 4 students develop a social enterprise idea to address a global challenge (announced each year by the UN Secretary-General). Campus rounds → regional semi-finals → global final with $1M prize. Free to enter.",
    type: 'COMPETITION' as const,
    url: 'https://www.hultprize.org/',
    organizer: 'Hult Prize Foundation',
    isAbroad: false,
    isRemote: true,
    format: 'HYBRID' as const,
    cost: 0,
    hasScholarship: false,
    stipend: 1000000,
    eligibleFields: ['BUSINESS', 'ECONOMICS', 'POLITICAL_SCIENCE', 'ENGINEERING'] as any[],
    minYearOfStudy: 1,
    maxYearOfStudy: 5,
    tags: ['competition', 'social-enterprise', 'hult-prize', 'global', 'startup', 'un'],
    sourceId: 'curated-hult-prize',
  },

  {
    title: 'CFA Institute Research Challenge — Italy',
    description: "Il CFA Research Challenge è una competizione internazionale per studenti universitari di economia e finanza. I team analizzano un'azienda quotata e presentano un report di analisi finanziaria a una giuria di professionisti CFA. Vincitori nazionali accedono alla finale EMEA. Gratuito.",
    type: 'COMPETITION' as const,
    url: 'https://www.cfainstitute.org/en/research/foundation/research-challenge',
    organizer: 'CFA Institute',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    cost: 0,
    hasScholarship: false,
    eligibleFields: ['ECONOMICS', 'BUSINESS', 'MATHEMATICS'] as any[],
    minYearOfStudy: 3,
    maxYearOfStudy: 5,
    tags: ['competition', 'finance', 'cfa', 'investment', 'analysis', 'italy'],
    sourceId: 'curated-cfa-research-challenge',
  },

  // ── BOOTCAMP — creative & design ──────────────────────────────────────────

  {
    title: 'Scuola Holden — Summer Intensive di Scrittura Creativa',
    description: "La Scuola Holden di Alessandro Baricco a Torino offre summer intensive di 1-2 settimane in scrittura creativa, storytelling, e content creation. Aperto a tutti, nessun prerequisito richiesto. Costo ~€600-1.200. Ideale per studenti di lettere, comunicazione e media.",
    type: 'BOOTCAMP' as const,
    url: 'https://scuolaholden.it/',
    organizer: 'Scuola Holden',
    location: 'Turin, Italy',
    city: 'Turin',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    durationDays: 10,
    cost: 900,
    hasScholarship: false,
    eligibleFields: ['HUMANITIES', 'DESIGN'] as any[],
    minYearOfStudy: 1,
    maxYearOfStudy: 6,
    tags: ['bootcamp', 'writing', 'creative', 'storytelling', 'turin', 'holden'],
    sourceId: 'curated-scuola-holden-summer',
  },

  // ── VOLUNTEERING ──────────────────��──────────────────────────────────────

  {
    title: 'UN Volunteers — Online Volunteering Program',
    description: "Il programma di volontariato online dell'ONU permette di contribuire a progetti di sviluppo internazionale da remoto, da casa. Disponibili opportunità in: ricerca, comunicazione, traduzione, IT, e coordinamento di progetti. Aperto a studenti universitari e laureati di tutto il mondo.",
    type: 'VOLUNTEERING' as const,
    url: 'https://www.onlinevolunteering.org/',
    organizer: 'United Nations Volunteers',
    isAbroad: false,
    isRemote: true,
    format: 'ONLINE' as const,
    cost: 0,
    hasScholarship: false,
    eligibleFields: [] as any[],
    minYearOfStudy: 2,
    maxYearOfStudy: 6,
    tags: ['volunteering', 'un', 'online', 'international', 'remote', 'social-impact'],
    sourceId: 'curated-un-volunteers-online',
  },

];

async function run() {
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const opp of opportunities) {
    try {
      const result = await upsertManualOpportunity(opp as any);
      if (result.action === 'created') created++;
      else updated++;
      logger.info(`[Seed2] ${result.action}: ${opp.title.slice(0, 60)}`);
    } catch (err) {
      logger.error(`[Seed2] Failed: ${opp.title.slice(0, 60)} — ${err}`);
      failed++;
    }
  }

  logger.info(`[Seed2] Done: ${created} created, ${updated} updated, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
