'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Code,
  Database,
  Smartphone,
  FlaskConical,
  Briefcase,
  TrendingUp,
  Palette,
  Leaf,
  Megaphone,
  Scale,
  Heart,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface InterestItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const INTERESTS: InterestItem[] = [
  { id: 'ai_ml', label: 'AI & Machine Learning', icon: Brain },
  { id: 'web_development', label: 'Web Development', icon: Code },
  { id: 'data_science', label: 'Data Science', icon: Database },
  { id: 'mobile_dev', label: 'Mobile Dev', icon: Smartphone },
  { id: 'ricerca_scientifica', label: 'Ricerca scientifica', icon: FlaskConical },
  { id: 'business_strategy', label: 'Business & Strategy', icon: Briefcase },
  { id: 'finance', label: 'Finance', icon: TrendingUp },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'sustainability', label: 'Sustainability', icon: Leaf },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'law_policy', label: 'Law & Policy', icon: Scale },
  { id: 'healthcare', label: 'Healthcare', icon: Heart },
];

const MAX_SELECTION = 3;

interface InterestCardProps {
  interest: InterestItem;
  isSelected: boolean;
  onClick: () => void;
}

function InterestCard({ interest, isSelected, onClick }: InterestCardProps) {
  const Icon = interest.icon;

  return (
    <motion.button
      onClick={onClick}
      className={`
        group relative overflow-hidden
        w-full aspect-square rounded-3xl
        transition-all duration-300 ease-out
        ${isSelected
          ? 'bg-gradient-to-br from-[#6B5FE4] to-[#5A4ED3] scale-[0.98]'
          : 'bg-[#1A1A2E] hover:bg-[#20203A] active:scale-95'
        }
      `}
      whileTap={{ scale: 0.95 }}
    >
      {/* Glow effect when selected */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 bg-[#6B5FE4] opacity-40 blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          exit={{ opacity: 0 }}
        />
      )}

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-4 gap-3">
        {/* Icon */}
        <div className={`
          transition-all duration-300
          ${isSelected ? 'scale-110' : 'scale-100 group-hover:scale-105'}
        `}>
          <Icon
            className={`
              w-6 h-6 transition-colors duration-300
              ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-white'}
            `}
          />
        </div>

        {/* Label */}
        <span className={`
          text-xs text-center leading-tight transition-all duration-300
          ${isSelected
            ? 'text-white font-semibold'
            : 'text-gray-300 font-medium group-hover:text-white'
          }
        `}>
          {interest.label}
        </span>
      </div>

      {/* Selection indicator (checkmark) */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute top-3 right-3"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-[#6B5FE4]"
              >
                <path
                  d="M11.5 3.5L5.5 9.5L2.5 6.5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      if (prev.includes(id)) {
        // Deselect
        return prev.filter((item) => item !== id);
      }
      if (prev.length < MAX_SELECTION) {
        // Add normally
        return [...prev, id];
      }
      // FIFO: remove first, add new
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

  const canContinue = selected.length > 0;

  return (
    <div className="relative z-10 flex flex-col min-h-screen px-6 pt-12 pb-8">
      {/* Progress Bar — 3 filled segments (this screen is the 3rd phase) */}
      <div className="flex gap-2 mb-10">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                boxShadow: '0 0 8px rgba(107,95,228,0.5)',
              }}
              initial={false}
              animate={{ width: '100%' }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        ))}
      </div>

      {/* Title Area */}
      <div className="mb-6">
        <h1 className="text-white text-[28px] leading-tight mb-2">
          Cosa ti appassiona?
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Seleziona fino a 3 aree che ti incuriosiscono
        </p>
      </div>

      {/* Counter */}
      <div className="mb-4 text-center">
        <span className="text-gray-400 text-sm">
          <span className="text-white font-medium">{selected.length}</span> / 3 selezionati
        </span>
      </div>

      {/* Interest Grid */}
      <div className="flex-1 overflow-y-auto -mx-2 px-2 scrollbar-hide">
        <div className="grid grid-cols-3 gap-3 pb-4">
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

      {/* Navigation Buttons */}
      <div className="mt-6 flex gap-3">
        {/* Back Button */}
        <motion.button
          onClick={onBack}
          className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.15)' }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ x: [0, -3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowLeft size={20} color="white" />
          </motion.div>
        </motion.button>

        {/* Next Button */}
        <motion.button
          onClick={handleContinue}
          disabled={!canContinue}
          className={`
            flex-1 h-14 rounded-full flex items-center justify-center gap-2
            transition-all duration-300
            ${canContinue
              ? 'bg-gradient-to-r from-[#6B5FE4] to-[#5A4ED3]'
              : 'bg-[#6B5FE4]/40 cursor-not-allowed'
            }
          `}
          whileHover={canContinue ? { boxShadow: '0 0 30px rgba(107,95,228,0.5)' } : {}}
          whileTap={canContinue ? { scale: 0.95 } : {}}
        >
          <span className="text-white font-medium text-sm">
            Continua
          </span>
          <motion.div
            animate={canContinue ? { x: [0, 3, 0] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowRight size={18} color="white" />
          </motion.div>
        </motion.button>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
