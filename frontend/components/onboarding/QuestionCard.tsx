'use client';

import { motion } from 'framer-motion';

interface Props {
  questionNumber: number;
  questionText: string;
  isMultiSelect: boolean;
  children: React.ReactNode;
}

export default function QuestionCard({ questionNumber, questionText, isMultiSelect, children }: Props) {
  return (
    <div>
      <p
        className="text-base text-[#2c3149] mb-8 leading-5"
        style={{ fontFamily: 'var(--font-plus-jakarta)' }}
      >
        {questionNumber}. {questionText}
      </p>

      {isMultiSelect && (
        <p className="text-xs text-[#595e78] mb-4" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
          Puoi selezionare più risposte
        </p>
      )}

      <motion.div
        className="flex flex-col gap-3"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
      >
        {children}
      </motion.div>
    </div>
  );
}
