'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Code, Database, Smartphone, FlaskConical,
  Briefcase, Landmark, Palette, Leaf, Megaphone, Scale, ShieldPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface InterestItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const INTERESTS: InterestItem[] = [
  { id: 'ai_ml',              label: 'AI & Machine Learning', icon: Brain },
  { id: 'web_development',    label: 'Web Development',       icon: Code },
  { id: 'data_science',       label: 'Data Science',          icon: Database },
  { id: 'mobile_dev',         label: 'Mobile Dev',            icon: Smartphone },
  { id: 'ricerca_scientifica',label: 'Ricerca scientifica',   icon: FlaskConical },
  { id: 'business_strategy',  label: 'Business & Strategy',   icon: Briefcase },
  { id: 'finance',            label: 'Finance',               icon: Landmark },
  { id: 'design',             label: 'Design',                icon: Palette },
  { id: 'sustainability',     label: 'Sustainability',        icon: Leaf },
  { id: 'marketing',          label: 'Marketing',             icon: Megaphone },
  { id: 'law_policy',         label: 'Law & Policy',          icon: Scale },
  { id: 'healthcare',         label: 'Healthcare',            icon: ShieldPlus },
];

const MAX_SELECTION = 3;

function InterestCard({
  interest,
  isSelected,
  onClick,
}: {
  interest: InterestItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = interest.icon;
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center justify-center gap-2.5 py-5 px-2 w-full rounded-[20px] border-2 transition-colors duration-200"
      style={{
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderColor: isSelected ? '#615fe2' : 'transparent',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 48,
          height: 48,
          backgroundColor: isSelected ? '#615fe2' : '#e8e8f2',
        }}
      >
        <Icon size={22} color={isSelected ? 'white' : '#595e78'} strokeWidth={1.8} />
      </div>
      <span
        className="text-[11px] text-center leading-tight"
        style={{
          fontFamily: 'var(--font-plus-jakarta)',
          color: isSelected ? '#615fe2' : '#2c3149',
          fontWeight: isSelected ? 600 : 400,
        }}
      >
        {interest.label}
      </span>
    </motion.button>
  );
}

export interface SelectedInterest {
  id: string;
  name: string;
  selectedAt: string;
}

interface InterestSelectionProps {
  onContinue: (interests: SelectedInterest[]) => void;
  onBack: () => void;
  initialSelection?: SelectedInterest[];
}

export default function InterestSelection({
  onContinue,
  onBack,
  initialSelection = [],
}: InterestSelectionProps) {
  const [selected, setSelected] = useState<string[]>(
    initialSelection.map((i) => i.id),
  );

  const toggleInterest = useCallback((id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length < MAX_SELECTION) return [...prev, id];
      return [...prev.slice(1), id];
    });
  }, []);

  const handleContinue = useCallback(() => {
    if (selected.length === 0) return;
    const now = new Date().toISOString();
    const interests: SelectedInterest[] = selected.map((id) => {
      const item = INTERESTS.find((i) => i.id === id)!;
      return { id: item.id, name: item.label, selectedAt: now };
    });
    onContinue(interests);
  }, [selected, onContinue]);

  return (
    <div className="h-full flex flex-col font-jakarta">

      {/* Header: back + progress */}
      <div className="px-6 pt-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center rounded-full hover:bg-[#e6e7f8] transition-colors shrink-0"
            style={{ width: 36, height: 36 }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4l-6 6 6 6" stroke="#595e78" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1 flex flex-col gap-1.5">
            <span className="text-sm text-[#595e78]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
              Step 1 di 3
            </span>
            <div className="h-2 bg-[#d8daf7] rounded-full overflow-hidden">
              <div className="h-full bg-[#615fe2] rounded-full" style={{ width: '33%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 no-scrollbar">

        {/* Title + subtitle */}
        <h1
          className="text-[30px] font-bold text-[#2c3149] leading-tight mb-2"
          style={{ fontFamily: 'var(--font-plus-jakarta)' }}
        >
          Cosa ti appassiona?
        </h1>
        <p className="text-[#595e78] text-sm mb-5" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
          Seleziona fino a 3 aree che ti incuriosiscono
        </p>

        {/* Counter badge */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6"
          style={{ backgroundColor: '#e8e9fc' }}
        >
          <div
            className="flex items-center justify-center rounded-full bg-[#615fe2] shrink-0"
            style={{ width: 16, height: 16 }}
          >
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span
            className="text-sm font-semibold text-[#615fe2]"
            style={{ fontFamily: 'var(--font-plus-jakarta)' }}
          >
            {selected.length} / 3 selezionati
          </span>
        </div>

        {/* Interest grid */}
        <div className="grid grid-cols-3 gap-3">
          {INTERESTS.map((interest) => (
            <InterestCard
              key={interest.id}
              interest={interest}
              isSelected={selected.includes(interest.id)}
              onClick={() => toggleInterest(interest.id)}
            />
          ))}
        </div>
      </div>

      {/* Fixed bottom button */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-6 pb-6 pt-12"
        style={{
          background: 'linear-gradient(to top, #eef0ff 60%, rgba(238,240,255,0.9) 80%, transparent 100%)',
        }}
      >
        <button
          onClick={handleContinue}
          disabled={selected.length === 0}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-[24px] font-bold text-white text-base disabled:opacity-40 transition-all"
          style={{
            fontFamily: 'var(--font-plus-jakarta)',
            backgroundColor: '#615fe2',
            filter: selected.length > 0 ? 'drop-shadow(0px 4px 7px rgba(74,75,215,0.39))' : 'none',
          }}
        >
          Continua
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M10 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
