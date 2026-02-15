'use client';

import { useState, useCallback } from 'react';

// ---------- Types ----------

interface Question {
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

interface Props {
  onComplete: (profileData: ProfileData) => void;
}

// ---------- Questions ----------

const QUESTIONS: Question[] = [
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

  // Weighted language base bonus, capped at 3.0
  let totalLangWeight = 0;
  for (const lang of languages) totalLangWeight += getLanguageWeight(lang);
  if (hasOtherLang) totalLangWeight += OTHER_LANGUAGE_WEIGHT;
  const baseLangBonus = Math.min(totalLangWeight, LANGUAGE_CAP);
  scores.INNOVATOR += baseLangBonus;
  scores.ANALYST += baseLangBonus;
  scores.LEADER += baseLangBonus;
  scores.HELPER += baseLangBonus;

  // Language-specific cluster bonuses
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

  // D6 — naturalActivity
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

  // D7 — freeTimeActivity
  if (answers[7] === 'Lavoro a un progetto personale') scores.INNOVATOR += 1;
  if (answers[7] === 'Leggo o mi informo su un settore specifico') scores.ANALYST += 1;
  if (answers[7] === 'Studio qualcosa di nuovo') scores.ANALYST += 0.5;
  if (answers[7] === 'Seguo un corso online') scores.ANALYST += 0.5;
  if (answers[7] === 'Ascolto podcast o contenuti formativi') scores.INNOVATOR += 0.5;

  // D8 — problemSolvingStyle
  if (answers[8] === 'Provo diverse soluzioni') scores.INNOVATOR += 1;
  if (answers[8] === 'Lo scompongo in parti più piccole') scores.ANALYST += 1;
  if (answers[8] === 'Cerco qualcuno più esperto') scores.HELPER += 1;

  // D9 — riskTolerance
  if (answers[9] === 'Molto') {
    scores.INNOVATOR += 1;
    scores.LEADER += 1;
  }

  // D2 — gpa (progressione lineare)
  if (answers[2] === '18-21') scores.ANALYST += 0.25;
  if (answers[2] === '21-24') scores.ANALYST += 0.5;
  if (answers[2] === '24-27') scores.ANALYST += 0.75;
  if (answers[2] === '27-30+') scores.ANALYST += 1;

  // D1 — yearOfStudy
  if ((answers[1] || '').startsWith('Magistrale')) scores.LEADER += 1;

  // D10 — careerPreference
  if (answers[10] === 'Costruire qualcosa di tuo') scores.INNOVATOR += 1;
  if (answers[10] === 'Percorso competitivo') scores.LEADER += 1;
  if (answers[10] === 'Percorso stabile') scores.HELPER += 1;
  if (answers[10] === 'Fare ricerca e innovazione') scores.ANALYST += 1;

  // D11 — professionalIdentity
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

function buildProfileData(
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

// ---------- Component ----------

export default function OnboardingFlow({ onComplete }: Props) {
  const totalSteps = 11;
  const [currentStep, setCurrentStep] = useState(0); // 0-10 = questions, 11 = final
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<number, string[]>>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isAnimating, setIsAnimating] = useState(false);

  const question = currentStep < totalSteps ? QUESTIONS[currentStep] : null;
  const questionId = question?.id ?? 0;
  const isMultiSelect = question?.selectionType === 'multiple';
  const selectedAnswer = answers[questionId] ?? '';
  const selectedMulti = multiAnswers[questionId] ?? [];
  const isOtherSelected = isMultiSelect
    ? selectedMulti.includes('__other__')
    : selectedAnswer === '__other__';

  const canGoNext = isMultiSelect
    ? true // multi-select allows proceeding with 0 selections
    : selectedAnswer !== '' && (!isOtherSelected || (otherTexts[questionId] ?? '').trim() !== '');

  const animateTo = useCallback((nextStep: number, dir: 'forward' | 'backward') => {
    setDirection(dir);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(nextStep);
      setIsAnimating(false);
    }, 300);
  }, []);

  const handleNext = useCallback(() => {
    if (!canGoNext || isAnimating) return;
    // Persist "other" text as the actual answer for single-select questions
    if (!isMultiSelect && isOtherSelected && otherTexts[questionId]) {
      setAnswers((prev) => ({ ...prev, [questionId]: otherTexts[questionId] }));
    }
    animateTo(currentStep + 1, 'forward');
  }, [canGoNext, isAnimating, isMultiSelect, isOtherSelected, otherTexts, questionId, currentStep, animateTo]);

  const handleBack = useCallback(() => {
    if (currentStep === 0 || isAnimating) return;
    animateTo(currentStep - 1, 'backward');
  }, [currentStep, isAnimating, animateTo]);

  const handleSelect = useCallback(
    (option: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: option }));
    },
    [questionId],
  );

  const handleMultiToggle = useCallback(
    (option: string) => {
      setMultiAnswers((prev) => {
        const current = prev[questionId] ?? [];
        const next = current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option];
        return { ...prev, [questionId]: next };
      });
    },
    [questionId],
  );

  const handleOtherText = useCallback(
    (text: string) => {
      setOtherTexts((prev) => ({ ...prev, [questionId]: text }));
    },
    [questionId],
  );

  const handleComplete = useCallback(() => {
    const profileData = buildProfileData(answers, multiAnswers, otherTexts);
    onComplete(profileData);
  }, [answers, multiAnswers, otherTexts, onComplete]);

  // Determine slide transform
  const getSlideStyle = (): React.CSSProperties => {
    if (!isAnimating) return { transform: 'translateX(0)', opacity: 1, transition: 'transform 300ms ease, opacity 300ms ease' };
    const offset = direction === 'forward' ? '-100%' : '100%';
    return { transform: `translateX(${offset})`, opacity: 0, transition: 'transform 300ms ease, opacity 300ms ease' };
  };

  // ---------- Final Screen ----------

  if (currentStep === totalSteps) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#0D1117' }}>
        {/* Checkmark circle */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
          style={{ backgroundColor: '#6C63FF' }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-3" style={{ fontFamily: 'var(--font-sora, Sora, sans-serif)' }}>
          Perfetto! Il tuo profilo è pronto.
        </h1>
        <p className="text-center mb-10" style={{ color: '#8B949E' }}>
          Abbiamo selezionato le migliori opportunità per te
        </p>

        <button
          onClick={handleComplete}
          className="w-full max-w-sm py-4 rounded-2xl text-white font-semibold text-lg transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: '#6C63FF' }}
        >
          Scopri le tue opportunità →
        </button>
      </div>
    );
  }

  // ---------- Question Screen ----------

  return (
    <div className="min-h-screen flex flex-col px-6 pt-12 pb-28" style={{ backgroundColor: '#0D1117' }}>
      {/* Progress bar */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className="h-1 rounded-full flex-1"
            style={{
              backgroundColor: i <= currentStep ? '#6C63FF' : '#2D3748',
              transition: 'background-color 300ms ease',
            }}
          />
        ))}
      </div>

      {/* Animated content */}
      <div style={getSlideStyle()}>
        {/* Back button */}
        {currentStep > 0 && (
          <button
            onClick={handleBack}
            className="mb-6 flex items-center gap-1 text-sm transition-opacity hover:opacity-80"
            style={{ color: '#8B949E' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Indietro
          </button>
        )}

        {/* Question number & text */}
        <div className="mb-6">
          <span className="text-sm font-bold mb-2 block" style={{ color: '#6C63FF' }}>
            Domanda {question!.id}/{totalSteps}
          </span>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-sora, Sora, sans-serif)' }}>
            {question!.question}
          </h2>
          {isMultiSelect && (
            <p className="text-xs mt-2" style={{ color: '#8B949E' }}>
              Puoi selezionare più risposte
            </p>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3">
          {question!.options.map((option) => {
            const isSelected = isMultiSelect
              ? selectedMulti.includes(option)
              : selectedAnswer === option;
            return (
              <button
                key={option}
                onClick={() => isMultiSelect ? handleMultiToggle(option) : handleSelect(option)}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all"
                style={{ backgroundColor: '#1C2333' }}
              >
                {/* Selection icon */}
                {isMultiSelect ? (
                  <div
                    className="flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      backgroundColor: isSelected ? '#6C63FF' : 'transparent',
                      border: isSelected ? 'none' : '2px solid #4A4A6A',
                    }}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: `2px solid ${isSelected ? '#6C63FF' : '#4A4A6A'}`,
                      backgroundColor: 'transparent',
                    }}
                  >
                    {isSelected && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#6C63FF' }} />
                    )}
                  </div>
                )}
                <span className="text-white text-sm">{option}</span>
              </button>
            );
          })}

          {/* "Altro" option with text field */}
          {question!.hasOtherField && (
            <div
              className="w-full rounded-2xl px-4 py-4 transition-all"
              style={{ backgroundColor: '#1C2333' }}
            >
              <button
                onClick={() => isMultiSelect ? handleMultiToggle('__other__') : handleSelect('__other__')}
                className="flex items-center gap-3 w-full text-left"
              >
                {isMultiSelect ? (
                  <div
                    className="flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      backgroundColor: isOtherSelected ? '#6C63FF' : 'transparent',
                      border: isOtherSelected ? 'none' : '2px solid #4A4A6A',
                    }}
                  >
                    {isOtherSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: `2px solid ${isOtherSelected ? '#6C63FF' : '#4A4A6A'}`,
                      backgroundColor: 'transparent',
                    }}
                  >
                    {isOtherSelected && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#6C63FF' }} />
                    )}
                  </div>
                )}
                <span className="text-white text-sm">Altro...</span>
              </button>
              {isOtherSelected && (
                <input
                  type="text"
                  value={otherTexts[questionId] ?? ''}
                  onChange={(e) => handleOtherText(e.target.value)}
                  placeholder="Scrivi qui"
                  autoFocus
                  className="mt-3 w-full bg-transparent text-white text-sm placeholder-gray-500 border-b outline-none pb-1"
                  style={{ borderColor: '#6C63FF' }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Next button — fixed bottom right */}
      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-opacity"
        style={{
          backgroundColor: '#6C63FF',
          opacity: canGoNext ? 1 : 0.5,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
