'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
    setSelectedAvatar(id);
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  const handleContinue = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate([10, 50, 20]);
    onContinue(selectedAvatar);
  }, [selectedAvatar, onContinue]);

  // Prefetch the video for the selected avatar so it's ready for the reveal
  useEffect(() => {
    const av = getAvatar(selectedAvatar);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'video';
    link.href = av.video;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [selectedAvatar]);

  return (
    <motion.div
      className="min-h-screen flex flex-col relative z-10 px-6 pt-14 pb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as const }}
    >
      {/* Header */}
      <div className="mb-8">
        {/* Sparkle icon */}
        <motion.svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          className="mb-4"
          initial={{ rotate: -20, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <path
            d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z"
            fill="url(#sparkleGrad)"
          />
          <defs>
            <linearGradient id="sparkleGrad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366f1" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </motion.svg>

        <motion.h1
          className="text-3xl font-bold text-white font-display leading-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          Scegli il tuo Avatar
        </motion.h1>

        <motion.p
          className="text-sm mt-2 leading-relaxed"
          style={{ color: '#8B8FA8' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          Personalizza la tua esperienza selezionando{'\n'}l&apos;avatar perfetto per te
        </motion.p>
      </div>

      {/* Large circular preview */}
      <motion.div
        className="self-center relative mb-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            padding: 3,
            filter: 'blur(1px)',
          }}
        />
        {/* Outer ring */}
        <div
          className="relative rounded-full p-[3px]"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {/* Avatar circle */}
          <div
            className="rounded-full overflow-hidden flex items-center justify-center"
            style={{ width: 280, height: 280, backgroundColor: '#FFFFFF' }}
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
        </div>

        {/* Checkmark badge — bottom right */}
        <AnimatePresence>
          {selectedAvatar && (
            <motion.div
              className="absolute flex items-center justify-center rounded-full"
              style={{
                width: 48,
                height: 48,
                bottom: 8,
                right: 8,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 15, delay: 0.1 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Avatar grid — always visible, 4 columns */}
      <motion.div
        className="w-full flex-1 min-h-0 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <div
          ref={scrollRef}
          className="w-full h-full overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div
            className="grid justify-items-center"
            style={{
              gridTemplateColumns: 'repeat(4, 70px)',
              columnGap: 12,
              rowGap: 20,
              justifyContent: 'center',
              padding: '4px 0',
            }}
          >
            {AVATARS.map((av) => {
              const isSelected = av.id === selectedAvatar;
              return (
                <motion.button
                  key={av.id}
                  onClick={() => handleAvatarSelect(av.id)}
                  className="relative rounded-full overflow-hidden"
                  style={{
                    width: 70,
                    height: 70,
                    backgroundColor: '#FFFFFF',
                    border: isSelected ? '2.5px solid #6366f1' : '2.5px solid transparent',
                    boxShadow: isSelected ? '0 0 16px rgba(99,102,241,0.35)' : '0 2px 8px rgba(0,0,0,0.2)',
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
                    sizes="70px"
                    loading="lazy"
                    quality={60}
                  />
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Continue button — full width */}
      <motion.button
        onClick={handleContinue}
        className="w-full py-4 rounded-2xl text-white font-semibold text-base flex items-center justify-center gap-2"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
        }}
        whileHover={{ scale: 1.02, boxShadow: '0 6px 28px rgba(99,102,241,0.45)' }}
        whileTap={{ scale: 0.97 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
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
