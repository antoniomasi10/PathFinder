'use client';

import { motion } from 'framer-motion';

interface Props {
  label: string;
  isSelected: boolean;
  isMultiSelect: boolean;
  onSelect: () => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

function CheckboxIcon({ checked }: { checked: boolean }) {
  if (checked) {
    return (
      <div className="flex-shrink-0 flex items-center justify-center rounded-[0.5rem] bg-[#615fe2]" style={{ width: '1.75rem', height: '1.75rem' }}>
        <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
          <path d="M1.5 5.5L5.5 9.5L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className="flex-shrink-0 rounded-[0.5rem] border-2 border-[rgba(172,176,206,0.6)] bg-white"
      style={{ width: '1.75rem', height: '1.75rem' }}
    />
  );
}

export default function OptionButton({ label, isSelected, onSelect }: Props) {
  return (
    <motion.button
      variants={itemVariants}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-[1.125rem] px-[1.125rem] py-[0.875rem] rounded-[1.5rem] text-left transition-colors duration-200 border-2"
      style={{
        backgroundColor: isSelected ? 'rgba(243,242,255,0.75)' : 'rgba(255,255,255,0.75)',
        borderColor: isSelected ? '#4a4bd7' : 'rgba(172,176,206,0.4)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <CheckboxIcon checked={isSelected} />
      <span
        className="text-base text-[#2c3149]"
        style={{
          fontFamily: 'var(--font-plus-jakarta)',
          fontWeight: isSelected ? 500 : 400,
        }}
      >
        {label}
      </span>
    </motion.button>
  );
}
