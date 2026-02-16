'use client';

import { motion } from 'framer-motion';
import { TOTAL_STEPS } from './onboarding-data';

interface Props {
  questionNumber: number;
  questionText: string;
  isMultiSelect: boolean;
  children: React.ReactNode;
}

export default function QuestionCard({ questionNumber, questionText, isMultiSelect, children }: Props) {
  return (
    <div>
      {/* Question number with gradient text */}
      <span className="text-sm font-bold mb-2 block text-gradient-accent">
        Domanda {questionNumber}/{TOTAL_STEPS}
      </span>

      {/* Question text */}
      <h2 className="text-2xl font-bold text-white font-display mb-2">
        {questionText}
      </h2>

      {isMultiSelect && (
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Puoi selezionare più risposte
        </p>
      )}

      {/* Options container with stagger animation */}
      <motion.div
        className="space-y-3 mt-6"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.05 } },
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
