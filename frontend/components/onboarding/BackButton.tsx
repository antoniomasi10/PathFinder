'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from '@/components/icons';

interface Props {
  onClick: () => void;
}

export default function BackButton({ onClick }: Props) {
  return (
    <motion.button
      onClick={onClick}
      className="w-16 h-16 rounded-full flex items-center justify-center"
      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.15)' }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        animate={{ x: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ArrowLeft size={24} color="white" />
      </motion.div>
    </motion.button>
  );
}
