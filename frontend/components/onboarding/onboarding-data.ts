// ---------- Types ----------

export interface Question {
  id: number;
  question: string;
  options: string[];
  hasOtherField: boolean;
  selectionType: 'single' | 'multiple';
}

export interface LanguageEntry {
  lingua: string;
  peso: number;
  valoreLibero?: string;
}

export interface ProfileData {
  answers: {
    yearOfStudy: string;
    gpa: string;
    englishLevel: string;
    languages: string[];
    willingToRelocate: string;
    naturalActivity: string;
    freeTimeActivity: string;
    problemSolvingStyle: string;
    riskTolerance: string;
    careerPreference: string;
    professionalIdentity: string;
  };
  cluster: 'INNOVATOR' | 'ANALYST' | 'LEADER' | 'HELPER';
  languages: LanguageEntry[];
  filters: {
    yearOfStudy: string;
    gpa: string;
    englishLevel: string;
    mobility: string;
  };
}

export interface OnboardingProps {
  onComplete: (profileData: ProfileData) => void;
}

// ---------- Questions ----------

export const QUESTIONS: Question[] = [
  {
    id: 1,
    question: 'In che anno di corso sei?',
    options: [
      'Triennale - 1° anno',
      'Triennale - 2° anno',
      'Triennale - 3° anno',
      'Magistrale - 1° anno',
      'Magistrale - 2° anno',
    ],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 2,
    question: 'Qual è la tua media voti attuale?',
    options: ['18-21', '21-24', '24-27', '27-30+'],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 3,
    question: 'Qual è il tuo livello di inglese?',
    options: ['A2 - Base', 'B1/B2 - Intermedio', 'C1 - Avanzato', 'C2+ - Madrelingua'],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 4,
    question: 'Conosci altre lingue straniere a livello intermedio o superiore?',
    options: ['Francese', 'Tedesco', 'Spagnolo', 'Russo', 'Cinese', 'Arabo', 'Giapponese', 'Coreano'],
    hasOtherField: true,
    selectionType: 'multiple',
  },
  {
    id: 5,
    question: 'Saresti disposto a trasferirti per un\'opportunità?',
    options: ['Sì, ovunque', 'Solo in Italia', 'Solo nella mia regione', 'No, preferisco restare nella mia città'],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 6,
    question: 'In un progetto di gruppo, quale ruolo ti ritrovi a fare anche senza che te lo chiedano?',
    options: [
      'Analizzare dati e numeri',
      'Creare qualcosa di nuovo',
      'Guidare un gruppo',
      'Risolvere problemi tecnici',
      'Aiutare direttamente le persone',
      'Insegnare o formare altri',
      'Comunicare e persuadere',
    ],
    hasOtherField: true,
    selectionType: 'single',
  },
  {
    id: 7,
    question: 'Se avessi un pomeriggio libero, cosa faresti?',
    options: [
      'Leggo o mi informo su un settore specifico',
      'Lavoro a un progetto personale',
      'Studio qualcosa di nuovo',
      'Faccio sport o attività pratica',
      'Seguo un corso online',
      'Ascolto podcast o contenuti formativi',
      'Esco con amici',
    ],
    hasOtherField: true,
    selectionType: 'single',
  },
  {
    id: 8,
    question: 'Quando affronti un problema, di solito...',
    options: [
      'Provo diverse soluzioni',
      'Lo scompongo in parti più piccole',
      'Cerco qualcuno più esperto',
      'Seguo il mio istinto',
    ],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 9,
    question: 'Quanto ti piace uscire dalla tua comfort zone?',
    options: ['Molto', 'Abbastanza', 'Poco', 'Per niente'],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 10,
    question: 'Quale percorso ti attira di più?',
    options: [
      'Costruire qualcosa di tuo',
      'Percorso competitivo',
      'Percorso stabile',
      'Fare ricerca e innovazione',
    ],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 11,
    question: 'Come ti identifichi professionalmente?',
    options: [
      'Imprenditore/fondatore',
      'Specialista',
      'Manager/leader',
      'Ricercatore/accademico',
    ],
    hasOtherField: false,
    selectionType: 'single',
  },
];

export const TOTAL_STEPS = QUESTIONS.length;

// ---------- Language weights ----------

const LANGUAGE_WEIGHTS: Record<string, number> = {
  Francese: 1.0,
  Tedesco: 1.0,
  Spagnolo: 1.0,
  Russo: 1.0,
  Cinese: 1.5,
  Arabo: 1.5,
  Giapponese: 1.5,
  Coreano: 1.5,
};
const OTHER_LANGUAGE_WEIGHT = 0.7;
const LANGUAGE_CAP = 3.0;

function getLanguageWeight(lang: string): number {
  return LANGUAGE_WEIGHTS[lang] ?? OTHER_LANGUAGE_WEIGHT;
}

function buildLanguageEntries(
  multiAnswers: Record<number, string[]>,
  otherTexts: Record<number, string>,
): LanguageEntry[] {
  const selected = multiAnswers[4] || [];
  const entries: LanguageEntry[] = selected.map((lang) => ({
    lingua: lang.toLowerCase(),
    peso: getLanguageWeight(lang),
  }));
  const otherText = (otherTexts[4] ?? '').trim();
  if (otherText) {
    entries.push({ lingua: 'altro', peso: OTHER_LANGUAGE_WEIGHT, valoreLibero: otherText });
  }
  return entries;
}

// ---------- Profiling ----------

function computeCluster(
  answers: Record<number, string>,
  multiAnswers: Record<number, string[]>,
  otherTexts: Record<number, string>,
): ProfileData['cluster'] {
  const scores = { INNOVATOR: 0, ANALYST: 0, LEADER: 0, HELPER: 0 };
  const languages = multiAnswers[4] || [];
  const hasOtherLang = (otherTexts[4] ?? '').trim() !== '';

  let totalLangWeight = 0;
  for (const lang of languages) totalLangWeight += getLanguageWeight(lang);
  if (hasOtherLang) totalLangWeight += OTHER_LANGUAGE_WEIGHT;
  const baseLangBonus = Math.min(totalLangWeight, LANGUAGE_CAP);
  scores.INNOVATOR += baseLangBonus;
  scores.ANALYST += baseLangBonus;
  scores.LEADER += baseLangBonus;
  scores.HELPER += baseLangBonus;

  if (languages.includes('Cinese')) { scores.INNOVATOR += 1.5; scores.ANALYST += 1.5; }
  if (languages.includes('Giapponese')) { scores.INNOVATOR += 1.5; scores.ANALYST += 1.5; }
  if (languages.includes('Coreano')) { scores.INNOVATOR += 1.5; scores.ANALYST += 1.5; }
  if (languages.includes('Arabo')) { scores.INNOVATOR += 1.5; scores.LEADER += 1.5; }
  if (languages.includes('Francese')) { scores.LEADER += 1.0; scores.HELPER += 1.0; }
  if (languages.includes('Spagnolo')) { scores.LEADER += 1.0; scores.HELPER += 1.0; }
  if (languages.includes('Tedesco')) { scores.ANALYST += 1.0; }
  if (languages.includes('Russo')) { scores.ANALYST += 1.0; scores.INNOVATOR += 1.0; }
  if (hasOtherLang) {
    scores.INNOVATOR += 0.7 / 4;
    scores.ANALYST += 0.7 / 4;
    scores.LEADER += 0.7 / 4;
    scores.HELPER += 0.7 / 4;
  }

  if (answers[6] === 'Creare qualcosa di nuovo') scores.INNOVATOR += 1;
  if (answers[6] === 'Analizzare dati e numeri') scores.ANALYST += 1;
  if (answers[6] === 'Guidare un gruppo') scores.LEADER += 1;
  if (answers[6] === 'Comunicare e persuadere') scores.LEADER += 1;
  if (answers[6] === 'Aiutare direttamente le persone') scores.HELPER += 1;
  if (answers[6] === 'Insegnare o formare altri') scores.HELPER += 1;
  if (answers[6] === 'Risolvere problemi tecnici') {
    scores.INNOVATOR += 0.5;
    scores.ANALYST += 0.5;
  }

  if (answers[7] === 'Lavoro a un progetto personale') scores.INNOVATOR += 1;
  if (answers[7] === 'Leggo o mi informo su un settore specifico') scores.ANALYST += 1;
  if (answers[7] === 'Studio qualcosa di nuovo') scores.ANALYST += 0.5;
  if (answers[7] === 'Seguo un corso online') scores.ANALYST += 0.5;
  if (answers[7] === 'Ascolto podcast o contenuti formativi') scores.INNOVATOR += 0.5;

  if (answers[8] === 'Provo diverse soluzioni') scores.INNOVATOR += 1;
  if (answers[8] === 'Lo scompongo in parti più piccole') scores.ANALYST += 1;
  if (answers[8] === 'Cerco qualcuno più esperto') scores.HELPER += 1;

  if (answers[9] === 'Molto') {
    scores.INNOVATOR += 1;
    scores.LEADER += 1;
  }

  if (answers[2] === '18-21') scores.ANALYST += 0.25;
  if (answers[2] === '21-24') scores.ANALYST += 0.5;
  if (answers[2] === '24-27') scores.ANALYST += 0.75;
  if (answers[2] === '27-30+') scores.ANALYST += 1;

  if ((answers[1] || '').startsWith('Magistrale')) scores.LEADER += 1;

  if (answers[10] === 'Costruire qualcosa di tuo') scores.INNOVATOR += 1;
  if (answers[10] === 'Percorso competitivo') scores.LEADER += 1;
  if (answers[10] === 'Percorso stabile') scores.HELPER += 1;
  if (answers[10] === 'Fare ricerca e innovazione') scores.ANALYST += 1;

  if (answers[11] === 'Imprenditore/fondatore') scores.INNOVATOR += 1;
  if (answers[11] === 'Specialista') scores.ANALYST += 1;
  if (answers[11] === 'Manager/leader') scores.LEADER += 1;
  if (answers[11] === 'Ricercatore/accademico') scores.HELPER += 1;

  const order: ProfileData['cluster'][] = ['INNOVATOR', 'ANALYST', 'LEADER', 'HELPER'];
  let best = order[0];
  for (const c of order) {
    if (scores[c] > scores[best]) best = c;
  }
  return best;
}

export function buildProfileData(
  answers: Record<number, string>,
  multiAnswers: Record<number, string[]>,
  otherTexts: Record<number, string>,
): ProfileData {
  const cluster = computeCluster(answers, multiAnswers, otherTexts);
  const rawLanguages = multiAnswers[4] || [];
  const languageEntries = buildLanguageEntries(multiAnswers, otherTexts);

  return {
    answers: {
      yearOfStudy: answers[1] ?? '',
      gpa: answers[2] ?? '',
      englishLevel: answers[3] ?? '',
      languages: rawLanguages,
      willingToRelocate: answers[5] ?? '',
      naturalActivity: answers[6] ?? '',
      freeTimeActivity: answers[7] ?? '',
      problemSolvingStyle: answers[8] ?? '',
      riskTolerance: answers[9] ?? '',
      careerPreference: answers[10] ?? '',
      professionalIdentity: answers[11] ?? '',
    },
    cluster,
    languages: languageEntries,
    filters: {
      yearOfStudy: answers[1] ?? '',
      gpa: answers[2] ?? '',
      englishLevel: answers[3] ?? '',
      mobility: answers[5] ?? '',
    },
  };
}
