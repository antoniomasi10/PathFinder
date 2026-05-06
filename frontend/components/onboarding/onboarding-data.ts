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

export interface InterestEntry {
  id: string;
  name: string;
  selectedAt: string;
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
    coreValue: string;
    careerPreference: string;
    professionalIdentity: string;
  };
  interests: InterestEntry[];
  cluster: 'Analista' | 'Creativo' | 'Leader' | 'Imprenditore' | 'Sociale' | 'Explorer';
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
      'Analizzare dati e trovare pattern',
      'Ideare soluzioni creative o visive',
      'Guidare il team verso l\'obiettivo',
      'Proporre idee e possibilità nuove',
      'Supportare e motivare le persone',
      'Portare esperienze e prospettive esterne',
      'Risolvere problemi tecnici nel dettaglio',
    ],
    hasOtherField: true,
    selectionType: 'single',
  },
  {
    id: 7,
    question: 'Cosa ti motiva di più in quello che fai?',
    options: [
      'Creare qualcosa che prima non esisteva',
      'Raggiungere risultati concreti e misurabili',
      'Fare la differenza nella vita delle persone',
      'Esplorare contesti e culture nuove',
      'Costruire qualcosa di mio, con autonomia',
      'Approfondire una materia fino in fondo',
    ],
    hasOtherField: true,
    selectionType: 'single',
  },
  {
    id: 8,
    question: 'Come preferisci affrontare una sfida nuova?',
    options: [
      'Con metodo: analizzo prima di agire',
      'Con creatività: cerco approcci originali',
      'Coordinando le persone giuste',
      'Sperimentando: accetto di sbagliare',
      'Costruendo consenso e supporto',
      'Traendo ispirazione da contesti diversi',
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
    question: 'Nel tuo percorso professionale, cosa conta di più per te?',
    options: [
      'La crescita personale e il riconoscimento dei risultati',
      'L\'impatto positivo sulla vita degli altri',
      'La libertà di esplorare, creare e sperimentare',
      'La stabilità e la profondità in un settore specifico',
    ],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 11,
    question: 'Tra 5 anni ti vedi...',
    options: [
      'A fondare o co-fondare un\'azienda',
      'Come esperto/specialista nel mio campo',
      'In un ruolo di leadership in una grande organizzazione',
      'A fare ricerca o innovazione avanzata',
      'A lavorare per un impatto sociale o ambientale',
      'In contesti internazionali sempre diversi',
      'A esprimere la mia creatività (arte, design, comunicazione...)',
    ],
    hasOtherField: false,
    selectionType: 'single',
  },
  {
    id: 12,
    question: 'Che tipo di opportunità stai cercando principalmente?',
    options: [
      'Evento breve (hackathon, conferenza, workshop)',
      'Stage o internship (1–12 mesi)',
      'Programma estivo o bootcamp',
      'Fellowship o programma lungo (6+ mesi)',
      'Scambio universitario / Erasmus',
      'Volontariato o extracurriculare',
      'Sono aperto a tutto',
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
  const scores: Record<ProfileData['cluster'], number> = {
    Analista: 0, Creativo: 0, Leader: 0, Imprenditore: 0, Sociale: 0, Explorer: 0,
  };

  const languages = multiAnswers[4] || [];
  const hasOtherLang = (otherTexts[4] ?? '').trim() !== '';

  // Base language bonus (distributed equally across all clusters)
  let totalLangWeight = 0;
  for (const lang of languages) totalLangWeight += getLanguageWeight(lang);
  if (hasOtherLang) totalLangWeight += OTHER_LANGUAGE_WEIGHT;
  const baseLangBonus = Math.min(totalLangWeight, LANGUAGE_CAP);
  for (const c of Object.keys(scores) as ProfileData['cluster'][]) scores[c] += baseLangBonus;

  // Language-specific cluster bonuses
  if (languages.includes('Cinese'))    { scores.Analista += 1.5; scores.Explorer += 1.5; }
  if (languages.includes('Giapponese')){ scores.Analista += 1.5; scores.Explorer += 1.5; }
  if (languages.includes('Coreano'))   { scores.Analista += 1.5; scores.Explorer += 1.5; }
  if (languages.includes('Arabo'))     { scores.Leader += 1.0; scores.Imprenditore += 1.0; scores.Explorer += 1.5; }
  if (languages.includes('Francese'))  { scores.Leader += 1.0; scores.Explorer += 1.0; scores.Sociale += 0.5; }
  if (languages.includes('Spagnolo'))  { scores.Explorer += 1.0; scores.Sociale += 0.5; }
  if (languages.includes('Tedesco'))   { scores.Analista += 1.0; scores.Leader += 0.5; }
  if (languages.includes('Russo'))     { scores.Analista += 1.0; scores.Explorer += 0.5; }
  if (hasOtherLang) {
    for (const c of Object.keys(scores) as ProfileData['cluster'][]) scores[c] += OTHER_LANGUAGE_WEIGHT / 6;
  }

  // Q6 — ruolo in un gruppo
  switch (answers[6]) {
    case 'Analizzare dati e trovare pattern':        scores.Analista += 2; break;
    case 'Ideare soluzioni creative o visive':       scores.Creativo += 2; break;
    case 'Guidare il team verso l\'obiettivo':       scores.Leader += 2; break;
    case 'Proporre idee e possibilità nuove':        scores.Imprenditore += 2; break;
    case 'Supportare e motivare le persone':         scores.Sociale += 2; break;
    case 'Portare esperienze e prospettive esterne': scores.Explorer += 2; break;
    case 'Risolvere problemi tecnici nel dettaglio': scores.Analista += 2; break;
  }

  // Q7 — motivazione
  switch (answers[7]) {
    case 'Creare qualcosa che prima non esisteva':      scores.Creativo += 1; scores.Imprenditore += 1; break;
    case 'Raggiungere risultati concreti e misurabili': scores.Analista += 1; scores.Leader += 1; break;
    case 'Fare la differenza nella vita delle persone': scores.Sociale += 2; break;
    case 'Esplorare contesti e culture nuove':          scores.Explorer += 2; break;
    case 'Costruire qualcosa di mio, con autonomia':    scores.Imprenditore += 2; break;
    case 'Approfondire una materia fino in fondo':      scores.Analista += 2; break;
  }

  // Q8 — approccio sfide
  switch (answers[8]) {
    case 'Con metodo: analizzo prima di agire':       scores.Analista += 2; break;
    case 'Con creatività: cerco approcci originali':  scores.Creativo += 2; break;
    case 'Coordinando le persone giuste':             scores.Leader += 2; break;
    case 'Sperimentando: accetto di sbagliare':       scores.Imprenditore += 2; break;
    case 'Costruendo consenso e supporto':            scores.Sociale += 2; break;
    case 'Traendo ispirazione da contesti diversi':   scores.Explorer += 2; break;
  }

  // Q9 — risk tolerance
  switch (answers[9]) {
    case 'Molto':
      scores.Imprenditore += 1; scores.Explorer += 0.5; scores.Leader += 0.5;
      break;
    case 'Abbastanza':
      scores.Leader += 0.5; scores.Imprenditore += 0.5;
      break;
    case 'Poco':
      scores.Analista += 0.5;
      break;
  }

  // Q10 — Schwartz: valore dominante (Self-Enhancement / Self-Transcendence / Openness / Conservation)
  switch (answers[10]) {
    case 'La crescita personale e il riconoscimento dei risultati':
      scores.Analista += 1.5; scores.Leader += 1.5; break;
    case 'L\'impatto positivo sulla vita degli altri':
      scores.Sociale += 3; break;
    case 'La libertà di esplorare, creare e sperimentare':
      scores.Creativo += 1; scores.Imprenditore += 1; scores.Explorer += 1; break;
    case 'La stabilità e la profondità in un settore specifico':
      scores.Analista += 1.5; break;
  }

  // Q11 — visione 5 anni
  switch (answers[11]) {
    case 'A fondare o co-fondare un\'azienda':                    scores.Imprenditore += 2; break;
    case 'Come esperto/specialista nel mio campo':                scores.Analista += 2; break;
    case 'In un ruolo di leadership in una grande organizzazione':scores.Leader += 2; break;
    case 'A fare ricerca o innovazione avanzata':                 scores.Analista += 1; scores.Explorer += 1; break;
    case 'A lavorare per un impatto sociale o ambientale':        scores.Sociale += 2; break;
    case 'In contesti internazionali sempre diversi':             scores.Explorer += 2; break;
    case 'A esprimere la mia creatività (arte, design, comunicazione...)': scores.Creativo += 2; break;
  }

  // Q1 — anno di corso
  if ((answers[1] || '').startsWith('Magistrale')) {
    scores.Leader += 1; scores.Explorer += 0.5;
  }

  // Q2 — media voti (segnale Analista)
  switch (answers[2]) {
    case '27-30+': scores.Analista += 1;    break;
    case '24-27':  scores.Analista += 0.75; break;
    case '21-24':  scores.Analista += 0.5;  break;
    case '18-21':  scores.Analista += 0.25; break;
  }

  // Q5 — mobilità
  if (answers[5] === 'Sì, ovunque') {
    scores.Explorer += 1; scores.Imprenditore += 0.5;
  }

  const order: ProfileData['cluster'][] = ['Analista', 'Creativo', 'Leader', 'Imprenditore', 'Sociale', 'Explorer'];
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
  interests: InterestEntry[] = [],
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
      coreValue: answers[10] ?? '',
      careerPreference: answers[11] ?? '',
      professionalIdentity: answers[12] ?? '',
    },
    interests,
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
