export interface CourseStat {
  label: string;
  value: number;
  color: string;
}

export interface CourseDeadline {
  date: string;
  label: string;
  status: 'past' | 'upcoming' | 'future';
}

export interface MockCourse {
  id: number;
  title: string;
  university: string;
  description: string;
  stats: CourseStat[];
  fullDescription: string;
  duration: string;
  language: string;
  mode: string;
  spots: number;
  cost: string;
  employmentRate: string;
  ranking: string;
  satisfaction: string;
  requirements: string[];
  subjects: string[];
  careerOutlets: string[];
  deadlines: CourseDeadline[];
  rentAvg: string;
  costOfLiving: string;
  distanceFromCenter: string;
}

export const MOCK_COURSES: MockCourse[] = [
  {
    id: 1,
    title: 'Master in Data Science e Business Analytics',
    university: 'Politecnico di Milano',
    description:
      'Un percorso avanzato che combina analisi dei dati, machine learning e strategia aziendale per formare professionisti capaci di trasformare i dati in decisioni.',
    stats: [
      { label: 'Affinità', value: 85, color: '#3DD68C' },
      { label: 'Lavoro', value: 94, color: '#4A9EFF' },
      { label: 'Mobilità', value: 78, color: '#4A9EFF' },
      { label: 'Laurea', value: 88, color: '#4A9EFF' },
      { label: 'Soddisf.', value: 91, color: '#4A9EFF' },
    ],
    fullDescription:
      'Questo Master di secondo livello offre una formazione completa in Data Science, Machine Learning, Deep Learning e Business Analytics. Il programma combina solide basi teoriche con progetti pratici in collaborazione con aziende leader come Amazon, Google e McKinsey. Gli studenti acquisiscono competenze in Python, R, SQL, TensorFlow e strumenti di visualizzazione dati.',
    duration: '2 anni',
    language: 'Inglese',
    mode: 'In presenza',
    spots: 50,
    cost: '€3.800/anno',
    employmentRate: '94%',
    ranking: '#5 in Europa',
    satisfaction: '91%',
    requirements: [
      'Laurea triennale',
      'Certificazione inglese B2+',
      'CV aggiornato',
      'Lettera motivazionale',
      'Tassa di iscrizione',
    ],
    subjects: [
      'Machine Learning',
      'Deep Learning',
      'Statistica avanzata',
      'Business Intelligence',
      'Big Data',
      'NLP',
    ],
    careerOutlets: [
      'Data Scientist',
      'ML Engineer',
      'Business Analyst',
      'Data Engineer',
      'AI Researcher',
    ],
    deadlines: [
      { date: '15 Gen 2026', label: 'Apertura candidature', status: 'past' },
      { date: '30 Apr 2026', label: 'Scadenza candidature', status: 'upcoming' },
      { date: '15-30 Mag 2026', label: 'Periodo colloqui', status: 'future' },
      { date: '15 Giu 2026', label: 'Pubblicazione risultati', status: 'future' },
    ],
    rentAvg: '€750/mese',
    costOfLiving: 'Alto',
    distanceFromCenter: '4.2 km',
  },
  {
    id: 2,
    title: 'Master in Artificial Intelligence',
    university: 'Università di Bologna',
    description:
      'Programma interdisciplinare focalizzato su deep learning, NLP e computer vision, con progetti pratici in collaborazione con aziende leader del settore.',
    stats: [
      { label: 'Affinità', value: 82, color: '#3DD68C' },
      { label: 'Lavoro', value: 90, color: '#4A9EFF' },
      { label: 'Mobilità', value: 75, color: '#4A9EFF' },
      { label: 'Laurea', value: 85, color: '#4A9EFF' },
      { label: 'Soddisf.', value: 89, color: '#4A9EFF' },
    ],
    fullDescription:
      'Il Master in Artificial Intelligence dell\'Università di Bologna è un programma all\'avanguardia che forma esperti in intelligenza artificiale con focus su deep learning, computer vision e natural language processing. Il programma include laboratori pratici, hackathon e stage presso aziende tech italiane e internazionali.',
    duration: '2 anni',
    language: 'Inglese',
    mode: 'In presenza',
    spots: 40,
    cost: '€2.900/anno',
    employmentRate: '90%',
    ranking: '#12 in Europa',
    satisfaction: '89%',
    requirements: [
      'Laurea triennale in STEM',
      'Certificazione inglese B2+',
      'CV aggiornato',
      'Lettera motivazionale',
      'Tassa di iscrizione',
    ],
    subjects: [
      'Deep Learning',
      'Computer Vision',
      'NLP',
      'Reinforcement Learning',
      'Robotica',
      'Etica dell\'AI',
    ],
    careerOutlets: [
      'AI Engineer',
      'Research Scientist',
      'Computer Vision Engineer',
      'NLP Specialist',
      'Robotics Engineer',
    ],
    deadlines: [
      { date: '1 Feb 2026', label: 'Apertura candidature', status: 'past' },
      { date: '15 Mag 2026', label: 'Scadenza candidature', status: 'upcoming' },
      { date: '1-15 Giu 2026', label: 'Periodo colloqui', status: 'future' },
      { date: '30 Giu 2026', label: 'Pubblicazione risultati', status: 'future' },
    ],
    rentAvg: '€550/mese',
    costOfLiving: 'Medio',
    distanceFromCenter: '2.8 km',
  },
  {
    id: 3,
    title: 'Master in Digital Marketing',
    university: 'Sapienza Università di Roma',
    description:
      'Forma esperti in strategie digitali, SEO, social media marketing e data-driven advertising con un approccio pratico e orientato al mercato.',
    stats: [
      { label: 'Affinità', value: 78, color: '#3DD68C' },
      { label: 'Lavoro', value: 88, color: '#4A9EFF' },
      { label: 'Mobilità', value: 82, color: '#4A9EFF' },
      { label: 'Laurea', value: 80, color: '#4A9EFF' },
      { label: 'Soddisf.', value: 86, color: '#4A9EFF' },
    ],
    fullDescription:
      'Il Master in Digital Marketing della Sapienza prepara professionisti del marketing digitale con competenze in SEO, SEM, social media management, content marketing e analytics. Il programma include workshop con professionisti del settore, case study reali e un progetto finale in collaborazione con aziende partner.',
    duration: '1 anno',
    language: 'Italiano',
    mode: 'Blended',
    spots: 35,
    cost: '€3.200/anno',
    employmentRate: '88%',
    ranking: '#18 in Europa',
    satisfaction: '86%',
    requirements: [
      'Laurea triennale',
      'Certificazione inglese B1+',
      'CV aggiornato',
      'Lettera motivazionale',
      'Tassa di iscrizione',
    ],
    subjects: [
      'SEO & SEM',
      'Social Media Marketing',
      'Content Strategy',
      'Data Analytics',
      'E-commerce',
      'Brand Management',
    ],
    careerOutlets: [
      'Digital Marketing Manager',
      'SEO Specialist',
      'Social Media Manager',
      'Growth Hacker',
      'Content Strategist',
    ],
    deadlines: [
      { date: '1 Mar 2026', label: 'Apertura candidature', status: 'past' },
      { date: '30 Giu 2026', label: 'Scadenza candidature', status: 'future' },
      { date: '10-20 Lug 2026', label: 'Periodo colloqui', status: 'future' },
      { date: '31 Lug 2026', label: 'Pubblicazione risultati', status: 'future' },
    ],
    rentAvg: '€650/mese',
    costOfLiving: 'Medio-Alto',
    distanceFromCenter: '3.5 km',
  },
];
