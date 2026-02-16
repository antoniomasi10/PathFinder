'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Props {
  label: string;
  isSelected: boolean;
  isMultiSelect: boolean;
  onSelect: () => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
};

export default function OptionButton({ label, isSelected, isMultiSelect, onSelect }: Props) {
  return (
    <motion.button
      variants={itemVariants}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-colors duration-200"
      style={{
        backgroundColor: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
        border: `1.5px solid ${isSelected ? '#6366f1' : 'transparent'}`,
      }}
    >
      {/* Selection indicator */}
      {isMultiSelect ? (
        <motion.div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            backgroundColor: isSelected ? '#6366f1' : 'rgba(255,255,255,0.1)',
            border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
          }}
          animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          {isSelected && <Check size={14} color="white" strokeWidth={3} />}
        </motion.div>
      ) : (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `1.5px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.2)'}`,
            backgroundColor: 'transparent',
          }}
        >
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#6366f1' }}
            />
          )}
        </div>
      )}

      <span className="text-white text-lg">{label}</span>
    </motion.button>
  );
}
