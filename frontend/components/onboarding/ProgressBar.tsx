'use client';

import { motion } from 'framer-motion';
import { TOTAL_STEPS } from './onboarding-data';

interface Props {
  currentStep: number;
}

export default function ProgressBar({ currentStep }: Props) {
  const pct = Math.round(((currentStep + 1) / TOTAL_STEPS) * 100);

  return (
    <div className="flex flex-col gap-2 mb-8">
      <span className="text-base text-[#595e78]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
        Step {currentStep + 1} di {TOTAL_STEPS}
      </span>
      <div className="h-2 bg-[#d8daf7] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[#615fe2] rounded-full"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }}
        />
      </div>
    </div>
  );
}
