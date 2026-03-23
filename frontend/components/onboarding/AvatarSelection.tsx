'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { AVATARS, DEFAULT_AVATAR_ID, getAvatar } from './avatarData';

interface Props {
  onContinue: (avatarId: string) => void;
}

export default function AvatarSelection({ onContinue }: Props) {
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATAR_ID);
  const scrollRef = useRef<HTMLDivElement>(null);

  const avatar = getAvatar(selectedAvatar);

  const handleAvatarSelect = useCallback((id: string) => {
    console.log('[AvatarSelection] Avatar selected:', id);
    setSelectedAvatar(id);
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  const handleContinue = useCallback(() => {
    console.log('[AvatarSelection] Continue pressed:', selectedAvatar);
    console.log('[AvatarSelection] Video that will play:', getAvatar(selectedAvatar).video);
    if (navigator.vibrate) navigator.vibrate([10, 50, 20]);
    onContinue(selectedAvatar);
  }, [selectedAvatar, onContinue]);

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center relative z-10 px-6 pt-10 pb-8"
      style={{ backgroundColor: '#0D1117' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Large preview — white circular frame */}
      <div
        className="relative rounded-full overflow-hidden flex items-center justify-center mb-8"
        style={{ width: 240, height: 240, backgroundColor: '#FFFFFF' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedAvatar}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
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
      </div>

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
                  backgroundColor: '#FFFFFF',
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
