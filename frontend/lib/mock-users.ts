// Mock user data matching the seed users — used as fallback when the API is unavailable.
// IDs are intentionally short strings so they're easy to use in demo/testing URLs.

export interface MockUser {
  id: string;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  courseOfStudy?: string | null;
  yearOfStudy?: number | null;
  university?: { name: string } | null;
  publicProfile: boolean;
  privacySavedOpps: string;
  privacyPathmates: string;
  messagePrivacy: string;
  canSeeSkills: boolean;
  profile?: { clusterTag?: string | null; passions: string[] } | null;
  savedOpportunities: Array<{
    id: string;
    title: string;
    company?: string | null;
    type: string;
    location?: string | null;
  }>;
  pathmates: Array<{
    id: string;
    name: string;
    avatar?: string | null;
    courseOfStudy?: string | null;
    university?: { name: string } | null;
  }>;
  pathmatesCount: number;
  friendStatus: string | null;
  isPathmate: boolean;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'mock-marco',
    name: 'Marco Rossi',
    avatar: null,
    bio: 'Appassionato di tech e startup. Sempre alla ricerca di nuove sfide.',
    courseOfStudy: 'Ingegneria Informatica',
    yearOfStudy: 3,
    university: { name: 'Politecnico di Milano' },
    publicProfile: true,
    privacySavedOpps: 'Tutti',
    privacyPathmates: 'Tutti',
    messagePrivacy: 'Tutti',
    canSeeSkills: true,
    profile: { clusterTag: 'Analista', passions: ['Programmazione', 'Intelligenza Artificiale', 'Startup'] },
    savedOpportunities: [
      { id: 's1', title: 'Software Engineer Intern', company: 'TechNova Solutions', type: 'INTERNSHIP' },
      { id: 's2', title: 'AI Research Fellow', company: 'DeepMind Italia', type: 'FELLOWSHIP' },
    ],
    pathmates: [
      { id: 'mock-giulia', name: 'Giulia Bianchi', courseOfStudy: 'Economia e Commercio', university: { name: 'Università di Bologna' } },
      { id: 'mock-luca', name: 'Luca Verdi', courseOfStudy: 'Ingegneria Aerospaziale', university: { name: 'Sapienza Università di Roma' } },
    ],
    pathmatesCount: 4,
    friendStatus: null,
    isPathmate: false,
  },
  {
    id: 'mock-giulia',
    name: 'Giulia Bianchi',
    avatar: null,
    bio: 'Economia e sostenibilità. Sogno di lavorare nell\'innovazione sociale.',
    courseOfStudy: 'Economia e Commercio',
    yearOfStudy: 2,
    university: { name: 'Università di Bologna' },
    publicProfile: true,
    privacySavedOpps: 'Pathmates',
    privacyPathmates: 'Pathmates',
    messagePrivacy: 'Pathmates',
    canSeeSkills: true,
    profile: { clusterTag: 'Leader', passions: ['Sostenibilità', 'Economia Circolare', 'Leadership'] },
    savedOpportunities: [
      { id: 's3', title: 'Business Analyst Stage', company: 'Accenture', type: 'STAGE' },
    ],
    pathmates: [
      { id: 'mock-marco', name: 'Marco Rossi', courseOfStudy: 'Ingegneria Informatica', university: { name: 'Politecnico di Milano' } },
      { id: 'mock-sara', name: 'Sara Ferrari', courseOfStudy: 'Architettura', university: { name: 'Università di Firenze' } },
    ],
    pathmatesCount: 4,
    friendStatus: null,
    isPathmate: false,
  },
  {
    id: 'mock-luca',
    name: 'Luca Verdi',
    avatar: null,
    bio: 'Futuro ingegnere aerospaziale. Appassionato di fisica e spazio.',
    courseOfStudy: 'Ingegneria Aerospaziale',
    yearOfStudy: 4,
    university: { name: 'Sapienza Università di Roma' },
    publicProfile: true,
    privacySavedOpps: 'Tutti',
    privacyPathmates: 'Tutti',
    messagePrivacy: 'Tutti',
    canSeeSkills: true,
    profile: { clusterTag: 'Analista', passions: ['Fisica', 'Spazio', 'Ricerca Scientifica'] },
    savedOpportunities: [
      { id: 's4', title: 'ESA Young Graduate Trainee', company: 'European Space Agency', type: 'FELLOWSHIP' },
      { id: 's5', title: 'Aeronautica Lab Internship', company: 'Leonardo S.p.A.', type: 'INTERNSHIP' },
    ],
    pathmates: [
      { id: 'mock-marco', name: 'Marco Rossi', courseOfStudy: 'Ingegneria Informatica', university: { name: 'Politecnico di Milano' } },
    ],
    pathmatesCount: 4,
    friendStatus: null,
    isPathmate: false,
  },
  {
    id: 'mock-sara',
    name: 'Sara Ferrari',
    avatar: null,
    bio: 'Design e architettura sostenibile. Amo creare spazi che raccontano storie.',
    courseOfStudy: 'Architettura',
    yearOfStudy: 3,
    university: { name: 'Università di Firenze' },
    publicProfile: true,
    privacySavedOpps: 'Nessuno',
    privacyPathmates: 'Nessuno',
    messagePrivacy: 'Pathmates',
    canSeeSkills: true,
    profile: { clusterTag: 'Creativo', passions: ['Design', 'Sostenibilità', 'Arte Contemporanea'] },
    savedOpportunities: [
      { id: 's6', title: 'Urban Design Internship', company: 'Studio Zaha Hadid', type: 'INTERNSHIP' },
    ],
    pathmates: [
      { id: 'mock-giulia', name: 'Giulia Bianchi', courseOfStudy: 'Economia e Commercio', university: { name: 'Università di Bologna' } },
    ],
    pathmatesCount: 4,
    friendStatus: null,
    isPathmate: false,
  },
  {
    id: 'mock-alessandro',
    name: 'Alessandro Conti',
    avatar: null,
    bio: 'Matricola con grandi sogni imprenditoriali.',
    courseOfStudy: 'Economia e Management',
    yearOfStudy: 1,
    university: { name: 'Università Ca\' Foscari' },
    publicProfile: false,
    privacySavedOpps: 'Pathmates',
    privacyPathmates: 'Pathmates',
    messagePrivacy: 'Pathmates',
    canSeeSkills: false,
    profile: { clusterTag: 'Imprenditore', passions: ['Startup', 'Business', 'Finanza'] },
    savedOpportunities: [],
    pathmates: [],
    pathmatesCount: 4,
    friendStatus: null,
    isPathmate: false,
  },
  {
    id: 'mock-thomas',
    name: 'Thomas Turbato',
    avatar: null,
    bio: 'Appassionato di marketing digitale e comunicazione strategica.',
    courseOfStudy: 'Comunicazione e Marketing',
    yearOfStudy: 2,
    university: { name: 'LUISS Guido Carli' },
    publicProfile: true,
    privacySavedOpps: 'Tutti',
    privacyPathmates: 'Tutti',
    messagePrivacy: 'Tutti',
    canSeeSkills: true,
    profile: { clusterTag: 'Sociale', passions: ['Marketing', 'Comunicazione', 'Social Media'] },
    savedOpportunities: [
      { id: 's7', title: 'Digital Marketing Intern', company: 'Publicis Italia', type: 'INTERNSHIP' },
    ],
    pathmates: [
      { id: 'mock-sara', name: 'Sara Ferrari', courseOfStudy: 'Architettura', university: { name: 'Università di Firenze' } },
    ],
    pathmatesCount: 2,
    friendStatus: null,
    isPathmate: false,
  },
];

export function getMockUserById(id: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}
