export interface CourseStat {
  label: string;
  value: number;
  color: string;
}

export interface CourseDeadline {
  date: string;
  label: string;
  status: 'past' | 'upcoming' | 'future';
  type?: 'apertura' | 'scadenza' | 'test' | 'risultati';
}

export interface CourseRequirement {
  label: string;
  type: 'english' | 'gpa' | 'degree' | 'test' | 'other';
  minEnglishLevel?: string;  // per type 'english': 'B1_B2', 'C1', 'C2_PLUS'
  minGpa?: string;           // per type 'gpa': 'GPA_25_27'
}

export interface MockCourse {
  id: number;
  title: string;
  university: string;
  city: string;
  description: string;
  stats: CourseStat[];
  fullDescription: string;
  duration: string;
  language: string;
  mode: string;
  spots: number | null;
  cost: string;
  employmentRate: string;
  ranking: string;
  satisfaction: string;
  requirements: CourseRequirement[];
  subjects: string[];
  careerOutlets: string[];
  deadlines: CourseDeadline[];
  rentAvg: string;
  costOfLiving: string;
  distanceFromCenter: string;
  officialUrl: string;
  requirementsUrl: string;
  sector: string;
  requiredEnglishLevel: string;
  competitiveness: number; // candidati stimati / posti (ratio)
  avgSalary: number; // stipendio netto medio annuo in € (AlmaLaurea)
  socialProof: {
    savedCount: number;
    simulatorRate: number; // percentuale arrotondata al 5%
    requirementsRate: number;
    appliedLastMonth: number;
  };
}

// Dati basati su fonti ufficiali: siti delle università, AlmaLaurea 2024.
// Ultimo aggiornamento: Marzo 2026.
export const MOCK_COURSES: MockCourse[] = [
  {
    id: 1,
    title: 'Laurea Magistrale in Computer Science and Engineering',
    university: 'Politecnico di Milano',
    city: 'Milano',
    description:
      'Laurea magistrale interamente in inglese con percorsi in Data Science, AI, Cybersecurity e Software Engineering. 97% di occupazione a 1 anno dalla laurea.',
    stats: [
      { label: 'Affinità', value: 87, color: '#3DD68C' },
      { label: 'Lavoro', value: 97, color: '#4A9EFF' },
      { label: 'Mobilità', value: 82, color: '#4A9EFF' },
      { label: 'Laurea', value: 92, color: '#4A9EFF' },
      { label: 'Soddisf.', value: 94, color: '#4A9EFF' },
    ],
    fullDescription:
      'La Laurea Magistrale in Computer Science and Engineering del Politecnico di Milano offre 11 percorsi specialistici tra cui Big Data Analytics, Artificial Intelligence & Machine Learning, Cybersecurity e Advanced Software Engineering. Il programma combina solide basi teoriche con progetti pratici e prevede opzioni di doppia laurea con università internazionali tramite i programmi EIT Digital ed Erasmus Mundus. Il 97% dei laureati magistrali trova lavoro entro 1 anno con uno stipendio medio netto di €1.994/mese.',
    duration: '2 anni',
    language: 'Inglese',
    mode: 'In presenza',
    spots: null, // Accesso su verifica requisiti, non a numero programmato
    cost: 'Da €157 a €3.893/anno (in base a ISEE)',
    employmentRate: '97%',
    ranking: 'Top 50 mondiale (QS)',
    satisfaction: '94%',
    requirements: [
      { label: 'Laurea triennale in Ingegneria Informatica, Informatica o affini', type: 'degree' },
      { label: 'Certificazione inglese B2', type: 'english', minEnglishLevel: 'B1_B2' },
      { label: 'Verifica requisiti curriculari', type: 'other' },
      { label: 'Valutazione della preparazione personale', type: 'other' },
    ],
    subjects: [
      'Machine Learning & AI',
      'Big Data Analytics',
      'Cybersecurity',
      'Advanced Software Engineering',
      'Robotics',
      'Computer Vision',
      'Bioinformatics',
    ],
    careerOutlets: [
      'Data Scientist',
      'ML Engineer',
      'Software Architect',
      'Cybersecurity Analyst',
      'AI Researcher',
    ],
    deadlines: [
      { date: '7 Lug 2025', label: 'Apertura candidature (1° sem)', status: 'past', type: 'apertura' },
      { date: '27 Ago 2025', label: 'Scadenza candidature (1° sem)', status: 'past', type: 'scadenza' },
      { date: '8 Gen 2026', label: 'Apertura candidature (2° sem)', status: 'past', type: 'apertura' },
      { date: '20 Feb 2026', label: 'Scadenza candidature (2° sem)', status: 'past', type: 'scadenza' },
    ],
    rentAvg: '€750/mese',
    costOfLiving: 'Alto',
    distanceFromCenter: '3.5 km',
    officialUrl: 'https://www.polimi.it/en/education/laurea-magistrale-programmes/programme-detail/computer-science-and-engineering',
    requirementsUrl: 'https://www.polimi.it/en/education/laurea-magistrale-programmes/programme-detail/computer-science-and-engineering',
    sector: 'Computer Science',
    requiredEnglishLevel: 'B2',
    competitiveness: 8,
    avgSalary: 23928, // €1.994/mese * 12
    socialProof: { savedCount: 342, simulatorRate: 80, requirementsRate: 85, appliedLastMonth: 47 },
  },
  {
    id: 2,
    title: 'Laurea Magistrale in Artificial Intelligence',
    university: 'Università di Bologna',
    city: 'Bologna',
    description:
      'Corso magistrale internazionale in AI con focus su deep learning, computer vision e NLP. 95% di occupazione a 1 anno con stipendio medio di €1.759/mese.',
    stats: [
      { label: 'Affinità', value: 84, color: '#3DD68C' },
      { label: 'Lavoro', value: 95, color: '#4A9EFF' },
      { label: 'Mobilità', value: 88, color: '#4A9EFF' },
      { label: 'Laurea', value: 89, color: '#4A9EFF' },
      { label: 'Soddisf.', value: 92, color: '#4A9EFF' },
    ],
    fullDescription:
      'La Laurea Magistrale in Artificial Intelligence dell\'Università di Bologna (Classe LM-18/LM-32) è un programma interamente in lingua inglese che fornisce competenze avanzate in machine learning, deep learning, computer vision e natural language processing. Il corso copre anche aspetti di etica dell\'AI, robotica e IoT. Secondo i dati AlmaLaurea 2024, il 95% dei laureati è occupato entro 1 anno con uno stipendio netto medio di €1.759/mese, e l\'84,2% utilizza le competenze acquisite nel proprio lavoro.',
    duration: '2 anni',
    language: 'Inglese',
    mode: 'In presenza',
    spots: null, // Accesso su verifica requisiti
    cost: 'Da €157 a ~€3.060/anno (in base a ISEE)',
    employmentRate: '95%',
    ranking: 'Top 150 mondiale (QS CS)',
    satisfaction: '92%',
    requirements: [
      { label: 'Laurea triennale in Informatica, Ingegneria, Matematica o affini', type: 'degree' },
      { label: 'Requisiti curriculari in CS e matematica', type: 'other' },
      { label: 'Certificazione inglese B2', type: 'english', minEnglishLevel: 'B1_B2' },
      { label: 'Valutazione della preparazione personale', type: 'other' },
    ],
    subjects: [
      'Machine Learning',
      'Computer Vision',
      'Natural Language Processing',
      'Reinforcement Learning',
      'Robotics & IoT',
      'AI Ethics',
      'Knowledge Representation',
    ],
    careerOutlets: [
      'AI Research Scientist',
      'Deep Learning Engineer',
      'Computer Vision Specialist',
      'NLP Engineer',
      'AI Product Manager',
    ],
    deadlines: [
      { date: 'Mar 2026', label: 'Apertura candidature (stima)', status: 'upcoming', type: 'apertura' },
      { date: 'Mag 2026', label: 'Scadenza candidature (stima)', status: 'future', type: 'scadenza' },
      { date: 'Giu 2026', label: 'Valutazione candidature', status: 'future', type: 'risultati' },
      { date: 'Set 2026', label: 'Inizio lezioni', status: 'future', type: 'apertura' },
    ],
    rentAvg: '€500/mese',
    costOfLiving: 'Medio',
    distanceFromCenter: '2.5 km',
    officialUrl: 'https://corsi.unibo.it/2cycle/artificial-intelligence',
    requirementsUrl: 'https://corsi.unibo.it/2cycle/artificial-intelligence/how-to-enrol',
    sector: 'Artificial Intelligence',
    requiredEnglishLevel: 'B2',
    competitiveness: 7,
    avgSalary: 21108, // €1.759/mese * 12
    socialProof: { savedCount: 218, simulatorRate: 75, requirementsRate: 80, appliedLastMonth: 31 },
  },
  {
    id: 3,
    title: 'Laurea Magistrale in Cybersecurity',
    university: 'Sapienza Università di Roma',
    city: 'Roma',
    description:
      'Prima laurea magistrale biennale in Cybersecurity in Italia. 100% di occupazione a 1 anno dalla laurea (dati AlmaLaurea 2024).',
    stats: [
      { label: 'Affinità', value: 81, color: '#3DD68C' },
      { label: 'Lavoro', value: 100, color: '#4A9EFF' },
      { label: 'Mobilità', value: 75, color: '#4A9EFF' },
      { label: 'Laurea', value: 87, color: '#4A9EFF' },
      { label: 'Soddisf.', value: 90, color: '#4A9EFF' },
    ],
    fullDescription:
      'La Laurea Magistrale in Cybersecurity della Sapienza (Classe LM-66) è la prima laurea magistrale biennale in sicurezza informatica offerta in Italia. Il programma, interamente in inglese, forma professionisti nella protezione di sistemi, reti e dati con tre percorsi specialistici: Software, Processes & Governance, e Infrastructures & Systems. Secondo AlmaLaurea 2024, il 100% dei laureati risulta occupato a 1 anno con stipendio netto medio di €1.860/mese.',
    duration: '2 anni',
    language: 'Inglese',
    mode: 'In presenza',
    spots: null, // Accesso su verifica requisiti (min. 44 CFU in settori specifici)
    cost: 'Max €2.924/anno (in base a ISEE)',
    employmentRate: '100%',
    ranking: 'Top 100 mondiale (CS - QS)',
    satisfaction: '90%',
    requirements: [
      { label: 'Laurea triennale con min. 44 CFU in Informatica, Ingegneria, Matematica o Statistica', type: 'degree' },
      { label: 'Certificazione inglese B2', type: 'english', minEnglishLevel: 'B1_B2' },
      { label: 'Verifica della preparazione personale', type: 'other' },
    ],
    subjects: [
      'Ethical Hacking',
      'Malware Analysis',
      'Digital Forensics',
      'Network Security',
      'Security Governance',
      'Data Protection',
      'Incident Response',
    ],
    careerOutlets: [
      'Cybersecurity Analyst',
      'Security Architect',
      'Penetration Tester',
      'SOC Analyst',
      'CISO',
    ],
    deadlines: [
      { date: 'Nov 2025', label: 'Prima rata iscrizione', status: 'past', type: 'scadenza' },
      { date: 'Dic 2025', label: 'Seconda rata iscrizione', status: 'past', type: 'scadenza' },
      { date: 'Mar 2026', label: 'Terza rata iscrizione', status: 'upcoming', type: 'scadenza' },
      { date: 'Set 2026', label: 'Inizio lezioni A.A. 2026/27', status: 'future', type: 'apertura' },
    ],
    rentAvg: '€600/mese',
    costOfLiving: 'Medio-Alto',
    distanceFromCenter: '3.0 km',
    officialUrl: 'https://cybersecurity.uniroma1.it/',
    requirementsUrl: 'https://cybersecurity.uniroma1.it/how-to-apply',
    sector: 'Cybersecurity',
    requiredEnglishLevel: 'B2',
    competitiveness: 5,
    avgSalary: 22320, // €1.860/mese * 12
    socialProof: { savedCount: 156, simulatorRate: 70, requirementsRate: 75, appliedLastMonth: 18 },
  },
  {
    id: 4,
    title: 'Laurea Magistrale in Automotive Engineering',
    university: 'Politecnico di Torino',
    city: 'Torino',
    description:
      'Master in ingegneria dell\'autoveicolo con focus su veicoli elettrici, guida autonoma e mobilità sostenibile. Opzione doppia laurea con University of Windsor (Canada).',
    stats: [
      { label: 'Affinità', value: 79, color: '#3DD68C' },
      { label: 'Lavoro', value: 95, color: '#4A9EFF' },
      { label: 'Mobilità', value: 85, color: '#4A9EFF' },
      { label: 'Laurea', value: 91, color: '#4A9EFF' },
      { label: 'Soddisf.', value: 93, color: '#4A9EFF' },
    ],
    fullDescription:
      'La Laurea Magistrale in Automotive Engineering (Ingegneria dell\'Autoveicolo) del Politecnico di Torino è un programma interamente in inglese che forma ingegneri specializzati nel settore automotive. Il primo anno copre powertrain elettrici e ibridi, dinamica del veicolo, ADAS e aerodinamica. Il secondo anno offre 4 percorsi specialistici: guida autonoma e connessa, progettazione veicoli elettrici/ibridi, sviluppo veicoli a basse emissioni, e motorsport. Prevede opzione di doppia laurea con la University of Windsor (Canada) tramite Erasmus+.',
    duration: '2 anni',
    language: 'Inglese',
    mode: 'In presenza',
    spots: null,
    cost: 'Da ~€500 a ~€4.000/anno (in base a ISEE)',
    employmentRate: '~95%',
    ranking: 'Top 50 Ingegneria Meccanica (QS)',
    satisfaction: '93%',
    requirements: [
      { label: 'Laurea triennale in Ingegneria Meccanica, Meccatronica o affini', type: 'degree' },
      { label: 'Conoscenze di meccanica, termodinamica ed elettronica', type: 'other' },
      { label: 'Certificazione inglese B2', type: 'english', minEnglishLevel: 'B1_B2' },
    ],
    subjects: [
      'Electric & Hybrid Powertrains',
      'Autonomous Driving Systems',
      'Vehicle Dynamics',
      'Automotive Electronics & ADAS',
      'Car Body Design & Aerodynamics',
      'Sustainable Mobility',
    ],
    careerOutlets: [
      'Automotive Engineer',
      'Electric Vehicle Specialist',
      'ADAS Developer',
      'Vehicle Dynamics Engineer',
      'Motorsport Engineer',
    ],
    deadlines: [
      { date: '30 Ott 2025', label: 'Scadenza candidature (1° sem)', status: 'past', type: 'scadenza' },
      { date: '30 Nov 2025', label: 'Scadenza iscrizione (1° sem)', status: 'past', type: 'scadenza' },
      { date: 'Apr 2026', label: 'Candidature (2° sem, stima)', status: 'upcoming', type: 'apertura' },
      { date: 'Set 2026', label: 'Inizio lezioni', status: 'future', type: 'apertura' },
    ],
    rentAvg: '€450/mese',
    costOfLiving: 'Medio',
    distanceFromCenter: '2.0 km',
    officialUrl: 'https://www.polito.it/en/education/master-s-degree-programmes/automotive-engineering',
    requirementsUrl: 'https://www.polito.it/en/education/master-s-degree-programmes/automotive-engineering',
    sector: 'Automotive',
    requiredEnglishLevel: 'B2',
    competitiveness: 4,
    avgSalary: 21600, // €1.800/mese * 12
    socialProof: { savedCount: 127, simulatorRate: 65, requirementsRate: 70, appliedLastMonth: 14 },
  },
  {
    id: 5,
    title: 'Master of Science in Marketing Management',
    university: 'Università Bocconi',
    city: 'Milano',
    description:
      'MSc d\'eccellenza in marketing. #2 in Europa per Marketing (QS 2025). 93,6% occupazione a 1 anno, 40,9% lavora all\'estero.',
    stats: [
      { label: 'Affinità', value: 76, color: '#3DD68C' },
      { label: 'Lavoro', value: 94, color: '#4A9EFF' },
      { label: 'Mobilità', value: 80, color: '#4A9EFF' },
      { label: 'Laurea', value: 94, color: '#4A9EFF' },
      { label: 'Soddisf.', value: 97, color: '#4A9EFF' },
    ],
    fullDescription:
      'Il Master of Science in Marketing Management della Bocconi è un programma d\'eccellenza classificato #2 in Europa per Marketing e #5 per Business & Management (QS 2025). Il corso, interamente in inglese, combina management, antropologia, psicologia del consumatore, diritto e metodi statistici. Ammette 255 studenti (3 classi da 85). Secondo i dati Bocconi, il 93,6% è occupato a 1 anno dalla laurea, il 78,6% già il giorno della laurea, e il 40,9% lavora all\'estero. Soddisfazione studenti: 96,9%.',
    duration: '2 anni',
    language: 'Inglese',
    mode: 'Full-time',
    spots: 255,
    cost: '€18.000/anno (tariffa fissa)',
    employmentRate: '93,6%',
    ranking: '#2 in Europa (QS Marketing 2025)',
    satisfaction: '96,9%',
    requirements: [
      { label: 'Laurea triennale in qualsiasi disciplina', type: 'degree' },
      { label: 'GMAT, GRE o test online Bocconi', type: 'test' },
      { label: 'Certificazione inglese C1', type: 'english', minEnglishLevel: 'C1' },
      { label: 'Valutazione dossier e motivazione', type: 'other' },
      { label: 'Tassa di candidatura €100', type: 'other' },
    ],
    subjects: [
      'Brand Management',
      'Consumer Behavior',
      'Marketing Analytics',
      'Strategic Marketing',
      'Digital Marketing',
      'Market Research',
    ],
    careerOutlets: [
      'Brand Manager',
      'Marketing Director',
      'Digital Marketing Manager',
      'Product Manager',
      'Marketing Consultant',
    ],
    deadlines: [
      { date: '9 Ott - 5 Nov 2025', label: 'I round candidature', status: 'past', type: 'scadenza' },
      { date: '6 Nov 2025 - 22 Gen 2026', label: 'II round candidature', status: 'past', type: 'scadenza' },
      { date: '23 Gen - 9 Mar 2026', label: 'III round candidature', status: 'upcoming', type: 'scadenza' },
      { date: '10 Mar - 29 Apr 2026', label: 'IV round candidature', status: 'future', type: 'scadenza' },
    ],
    rentAvg: '€750/mese',
    costOfLiving: 'Alto',
    distanceFromCenter: '2.5 km',
    officialUrl: 'https://www.unibocconi.it/en/programs/master-science/marketing-management',
    requirementsUrl: 'https://www.unibocconi.it/en/programs/master-science/marketing-management/admission',
    sector: 'Marketing',
    requiredEnglishLevel: 'C1',
    competitiveness: 6,
    avgSalary: 24000, // €2.000/mese * 12 (Bocconi premium)
    socialProof: { savedCount: 289, simulatorRate: 85, requirementsRate: 90, appliedLastMonth: 38 },
  },
];
