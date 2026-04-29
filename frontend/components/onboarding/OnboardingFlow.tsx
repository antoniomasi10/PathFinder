'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QUESTIONS, TOTAL_STEPS, buildProfileData } from './onboarding-data';
import type { ProfileData, InterestEntry } from './onboarding-data';
import AmbientBackground from './AmbientBackground';
import ProgressBar from './ProgressBar';
import QuestionCard from './QuestionCard';
import OptionButton from './OptionButton';
import NextButton from './NextButton';
import BackButton from './BackButton';
import AvatarSelection from './AvatarSelection';
import InterestSelection from './InterestSelection';
import type { SelectedInterest } from './InterestSelection';
import api from '@/lib/api';

interface OnboardingFlowProps {
  onAvatarSelected: (profileData: ProfileData, avatarId: string) => void;
}

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
};

const slideTransition = { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const };

export default function OnboardingFlow({ onAvatarSelected }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<number, string[]>>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});
  const [direction, setDirection] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<SelectedInterest[]>([]);

  const question = currentStep < TOTAL_STEPS ? QUESTIONS[currentStep] : null;
  const questionId = question?.id ?? 0;
  const isMultiSelect = question?.selectionType === 'multiple';
  const selectedAnswer = answers[questionId] ?? '';
  const selectedMulti = multiAnswers[questionId] ?? [];
  const isOtherSelected = isMultiSelect
    ? selectedMulti.includes('__other__')
    : selectedAnswer === '__other__';

  const canGoNext = isMultiSelect
    ? true
    : selectedAnswer !== '' && (!isOtherSelected || (otherTexts[questionId] ?? '').trim() !== '');

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    if (!isMultiSelect && isOtherSelected && otherTexts[questionId]) {
      setAnswers((prev) => ({ ...prev, [questionId]: otherTexts[questionId] }));
    }
    setDirection(1);
    setCurrentStep((s) => s + 1);
  }, [canGoNext, isMultiSelect, isOtherSelected, otherTexts, questionId]);

  const handleBack = useCallback(() => {
    if (currentStep === 0) return;
    setDirection(-1);
    setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleSelect = useCallback(
    (option: string) => setAnswers((prev) => ({ ...prev, [questionId]: option })),
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
    (text: string) => setOtherTexts((prev) => ({ ...prev, [questionId]: text })),
    [questionId],
  );

  const handleInterestsContinue = useCallback(async (interests: SelectedInterest[]) => {
    setSelectedInterests(interests);
    // Save interests to backend
    try {
      await api.patch('/profile/me', { interests });
    } catch (err) {
      console.error('Failed to save interests:', err);
    }
    setDirection(1);
    setCurrentStep((s) => s + 1);
  }, []);

  const handleInterestsBack = useCallback(() => {
    setDirection(-1);
    setCurrentStep((s) => s - 1);
  }, []);

  const handleAvatarContinue = useCallback((avatarId: string) => {
    const profileData = buildProfileData(answers, multiAnswers, otherTexts, selectedInterests);
    onAvatarSelected(profileData, avatarId);
  }, [answers, multiAnswers, otherTexts, selectedInterests, onAvatarSelected]);

  // ---------- Avatar Selection Screen (after interests) ----------
  if (currentStep === TOTAL_STEPS + 1) {
    return (
      <>
        <AmbientBackground />
        <AvatarSelection onContinue={handleAvatarContinue} />
      </>
    );
  }

  // ---------- Questionnaire + Interest Selection (with cross-fade transition) ----------
  // Determine which phase we're in: 'questions' or 'interests'
  const phase = currentStep < TOTAL_STEPS ? 'questions' : 'interests';

  return (
    <div className="min-h-screen relative font-jakarta" style={{ background: '#fbf8ff' }}>
      {/* Watermark decorativo */}
      <img
        src="/logo-coha-watermark.svg"
        alt=""
        aria-hidden
        className="absolute pointer-events-none select-none"
        style={{ left: -440, top: 71, width: 1070, height: 782, opacity: 1 }}
      />

      <AnimatePresence mode="wait">
        {phase === 'interests' ? (
          <motion.div
            key="interests"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <InterestSelection
              onContinue={handleInterestsContinue}
              onBack={handleInterestsBack}
              initialSelection={selectedInterests}
            />
          </motion.div>
        ) : (
          <motion.div
            key="questions"
            initial={false}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 flex flex-col min-h-screen"
            style={{
              border: '8px solid white',
              boxShadow: '0px 0px 0px 1px rgba(172,176,206,0.3), 0px 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            {/* Contenuto scrollabile */}
            <div className="flex-1 overflow-y-auto pt-6 px-6 pb-32">
              {/* Barra progresso + back */}
              <div className="flex items-center gap-3 mb-0">
                {currentStep > 0 && <BackButton onClick={handleBack} />}
                <div className="flex-1">
                  <ProgressBar currentStep={currentStep} />
                </div>
              </div>

              {/* Domanda + opzioni animate */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={slideTransition}
                >
                  <QuestionCard
                    questionNumber={question!.id}
                    questionText={question!.question}
                    isMultiSelect={isMultiSelect}
                  >
                    {question!.options.map((option) => {
                      const isSelected = isMultiSelect
                        ? selectedMulti.includes(option)
                        : selectedAnswer === option;
                      return (
                        <OptionButton
                          key={option}
                          label={option}
                          isSelected={isSelected}
                          isMultiSelect={isMultiSelect}
                          onSelect={() => isMultiSelect ? handleMultiToggle(option) : handleSelect(option)}
                        />
                      );
                    })}

                    {/* Opzione "Altro" */}
                    {question!.hasOtherField && (
                      <motion.div
                        variants={{
                          hidden: { opacity: 0, y: 16 },
                          visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
                        }}
                        className="w-full rounded-[24px] px-[18px] py-[14px] border-2 transition-colors duration-200"
                        style={{
                          backgroundColor: isOtherSelected ? 'rgba(243,242,255,0.75)' : 'rgba(255,255,255,0.75)',
                          borderColor: isOtherSelected ? '#4a4bd7' : 'rgba(172,176,206,0.4)',
                        }}
                      >
                        <button
                          onClick={() => isMultiSelect ? handleMultiToggle('__other__') : handleSelect('__other__')}
                          className="flex items-center gap-[18px] w-full text-left"
                        >
                          <div
                            className="flex-shrink-0 flex items-center justify-center rounded-[8px]"
                            style={{
                              width: 28, height: 28,
                              backgroundColor: isOtherSelected ? '#615fe2' : 'white',
                              border: isOtherSelected ? 'none' : '2px solid rgba(172,176,206,0.6)',
                            }}
                          >
                            {isOtherSelected && (
                              <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                                <path d="M1.5 5.5L5.5 9.5L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span
                            className="text-base text-[#2c3149]"
                            style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: isOtherSelected ? 500 : 400 }}
                          >
                            Altro...
                          </span>
                        </button>

                        <AnimatePresence>
                          {isOtherSelected && (
                            <motion.input
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              type="text"
                              value={otherTexts[questionId] ?? ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOtherText(e.target.value)}
                              placeholder="Scrivi qui"
                              autoFocus
                              className="mt-3 w-full bg-transparent text-[#2c3149] text-sm placeholder-[#acb0ce] border-b border-[#615fe2] outline-none pb-1"
                            />
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </QuestionCard>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom action con gradient fade */}
            <div
              className="fixed bottom-0 left-0 right-0 z-20 px-6 pb-6 pt-12"
              style={{
                background: 'linear-gradient(to top, #fbf8ff 60%, rgba(251,248,255,0.9) 80%, transparent 100%)',
              }}
            >
              <NextButton disabled={!canGoNext} onClick={handleNext} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
