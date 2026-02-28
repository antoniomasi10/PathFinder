'use client';

import { motion } from 'framer-motion';
import { TOTAL_STEPS } from './onboarding-data';

interface Props {
  currentStep: number;
}

export default function ProgressBar({ currentStep }: Props) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
            initial={false}
            animate={{ width: i <= currentStep ? '100%' : '0%' }}
            transition={{ duration: 0.6, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] as const }}
          />
        </div>
      ))}
    </div>
  );
}
