'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

export default function CompletionScreen({ onComplete }: Props) {
  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as const }}
    >
      {/* Checkmark circle */}
      <motion.div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      >
        <motion.div
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Check size={48} color="white" strokeWidth={2.5} />
        </motion.div>
      </motion.div>

      <motion.h1
        className="text-2xl font-bold text-white text-center mb-3 font-display"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        Perfetto! Il tuo profilo è pronto.
      </motion.h1>

      <motion.p
        className="text-center mb-10"
        style={{ color: 'rgba(255,255,255,0.5)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        Abbiamo selezionato le migliori opportunità per te
      </motion.p>

      <motion.button
        onClick={onComplete}
        className="w-full max-w-sm py-4 rounded-2xl text-white font-semibold text-lg"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(99,102,241,0.3)' }}
        whileTap={{ scale: 0.98 }}
      >
        Scopri le tue opportunità →
      </motion.button>
    </motion.div>
  );
}
