'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QUESTIONS, TOTAL_STEPS, buildProfileData } from './onboarding-data';
import type { ProfileData } from './onboarding-data';
import AmbientBackground from './AmbientBackground';
import ProgressBar from './ProgressBar';
import QuestionCard from './QuestionCard';
import OptionButton from './OptionButton';
import NextButton from './NextButton';
import BackButton from './BackButton';
import AvatarSelection from './AvatarSelection';

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

  const handleAvatarContinue = useCallback((avatarId: string) => {
    const profileData = buildProfileData(answers, multiAnswers, otherTexts);
    onAvatarSelected(profileData, avatarId);
  }, [answers, multiAnswers, otherTexts, onAvatarSelected]);

  // ---------- Avatar Selection Screen (after questionnaire) ----------
  if (currentStep === TOTAL_STEPS) {
    return (
      <>
        <AmbientBackground />
        <AvatarSelection onContinue={handleAvatarContinue} />
      </>
    );
  }

  // ---------- Question Screen ----------
  return (
    <div className="min-h-screen relative">
      <AmbientBackground />

      <div className="relative z-10 flex flex-col min-h-screen px-6 pt-12 pb-32">
        {/* Progress bar */}
        <ProgressBar currentStep={currentStep} />

        {/* Animated question content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="mt-8 flex-1"
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

              {/* "Altro" option */}
              {question!.hasOtherField && (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
                  }}
                  className="w-full rounded-2xl px-4 py-4 transition-colors duration-200"
                  style={{
                    backgroundColor: isOtherSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${isOtherSelected ? '#6366f1' : 'transparent'}`,
                  }}
                >
                  <button
                    onClick={() => isMultiSelect ? handleMultiToggle('__other__') : handleSelect('__other__')}
                    className="flex items-center gap-3 w-full text-left"
                  >
                    {isMultiSelect ? (
                      <motion.div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          backgroundColor: isOtherSelected ? '#6366f1' : 'rgba(255,255,255,0.1)',
                          border: isOtherSelected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                        }}
                        animate={isOtherSelected ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.3 }}
                      >
                        {isOtherSelected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </motion.div>
                    ) : (
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: 22, height: 22, borderRadius: '50%',
                          border: `1.5px solid ${isOtherSelected ? '#6366f1' : 'rgba(255,255,255,0.2)'}`,
                        }}
                      >
                        {isOtherSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#6366f1' }}
                          />
                        )}
                      </div>
                    )}
                    <span className="text-white text-lg">Altro...</span>
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
                        className="mt-3 w-full bg-transparent text-white text-sm placeholder-gray-500 border-b outline-none pb-1"
                        style={{ borderColor: '#6366f1' }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </QuestionCard>
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons — fixed bottom */}
        <div className="fixed bottom-8 left-6 right-6 flex justify-between items-center z-20">
          <div>
            {currentStep > 0 && <BackButton onClick={handleBack} />}
          </div>
          <NextButton disabled={!canGoNext} onClick={handleNext} />
        </div>
      </div>
    </div>
  );
}
