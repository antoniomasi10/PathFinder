'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { AVATARS, BG_COLORS, DEFAULT_AVATAR_ID, DEFAULT_BG_COLOR, getAvatar } from './avatarData';

interface Props {
  onContinue: (avatarId: string, bgColor: string) => void;
}

export default function AvatarSelection({ onContinue }: Props) {
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATAR_ID);
  const [selectedBg, setSelectedBg] = useState(DEFAULT_BG_COLOR);
  const scrollRef = useRef<HTMLDivElement>(null);

  const avatar = getAvatar(selectedAvatar);

  const handleAvatarSelect = useCallback((id: string) => {
    setSelectedAvatar(id);
    // Haptic feedback (web vibration API)
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  const handleBgSelect = useCallback((hex: string) => {
    setSelectedBg(hex);
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  const handleContinue = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate([10, 50, 20]);
    onContinue(selectedAvatar, selectedBg);
  }, [selectedAvatar, selectedBg, onContinue]);

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center relative z-10 px-6 pt-10 pb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Large preview */}
      <motion.div
        className="relative rounded-full overflow-hidden flex items-center justify-center mb-8"
        style={{ width: 240, height: 240, backgroundColor: selectedBg }}
        layout
        transition={{ duration: 0.2 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedAvatar}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full relative"
          >
            <Image
              src={avatar.blindfolded}
              alt="Avatar selezionato"
              fill
              className="object-cover"
              priority
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Section: Choose avatar */}
      <h2 className="text-white text-lg font-semibold mb-4 self-start">
        Scegli il tuo avatar
      </h2>

      {/* Avatar grid - horizontal scroll */}
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto pb-4 mb-6 scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <div className="flex gap-3" style={{ width: 'max-content' }}>
          {AVATARS.map((av) => {
            const isSelected = av.id === selectedAvatar;
            return (
              <motion.button
                key={av.id}
                onClick={() => handleAvatarSelect(av.id)}
                className="relative flex-shrink-0 rounded-full overflow-hidden"
                style={{
                  width: 60,
                  height: 60,
                  scrollSnapAlign: 'start',
                  border: isSelected ? '3px solid white' : '3px solid transparent',
                  boxShadow: isSelected ? '0 0 12px rgba(255,255,255,0.3)' : 'none',
                }}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.15 }}
                aria-label={`Avatar ${av.id.replace('avatar_', '')}`}
              >
                <Image
                  src={av.blindfolded}
                  alt={`Avatar ${av.id.replace('avatar_', '')}`}
                  fill
                  className="object-cover"
                  sizes="60px"
                />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Section: Choose background */}
      <h2 className="text-white text-lg font-semibold mb-4 self-start">
        Scegli lo sfondo
      </h2>

      {/* Color swatches - horizontal scroll */}
      <div
        className="w-full overflow-x-auto pb-4 mb-8 scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <div className="flex gap-3" style={{ width: 'max-content' }}>
          {BG_COLORS.map((color) => {
            const isSelected = color.hex === selectedBg;
            return (
              <motion.button
                key={color.id}
                onClick={() => handleBgSelect(color.hex)}
                className="flex-shrink-0 rounded-full"
                style={{
                  width: 50,
                  height: 50,
                  backgroundColor: color.hex,
                  scrollSnapAlign: 'start',
                  border: isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.15)',
                  boxShadow: isSelected ? '0 0 12px rgba(255,255,255,0.3)' : 'none',
                }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.15 }}
                aria-label={`Sfondo ${color.label}`}
              />
            );
          })}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Continue button */}
      <motion.button
        onClick={handleContinue}
        className="self-end px-8 py-3 rounded-xl text-white font-semibold text-base flex items-center gap-2"
        style={{ backgroundColor: '#6C63FF' }}
        whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(108,99,255,0.4)' }}
        whileTap={{ scale: 0.97 }}
        aria-label="Continua alla rivelazione dell'avatar"
      >
        Continua
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </motion.button>
    </motion.div>
  );
}
