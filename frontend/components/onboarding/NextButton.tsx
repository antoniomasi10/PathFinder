'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface Props {
  disabled: boolean;
  onClick: () => void;
}

export default function NextButton({ disabled, onClick }: Props) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="w-16 h-16 rounded-full flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        opacity: disabled ? 0.4 : 1,
      }}
      whileHover={disabled ? {} : { scale: 1.05, boxShadow: '0 0 24px rgba(99,102,241,0.4)' }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <motion.div
        animate={{ x: [0, 3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ArrowRight size={24} color="white" />
      </motion.div>
    </motion.button>
  );
}
