'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { AVATARS, DEFAULT_AVATAR_ID, getAvatar } from './avatarData';

interface Props {
  onContinue: (avatarId: string) => void;
  onBack?: () => void;
}

export default function AvatarSelection({ onContinue, onBack }: Props) {
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

  // Prefetch video per il reveal
  useEffect(() => {
    const av = getAvatar(selectedAvatar);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'video';
    link.href = av.video;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [selectedAvatar]);

  return (
    <div className="h-full flex flex-col font-jakarta">

      {/* Header: back + progress */}
      <div className="px-6 pt-6 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center justify-center rounded-full hover:bg-[#e6e7f8] transition-colors shrink-0"
              style={{ width: 36, height: 36 }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M13 4l-6 6 6 6" stroke="#595e78" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <div className="flex-1 flex flex-col gap-1.5">
            <span className="text-sm text-[#595e78]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
              Step 2 di 3
            </span>
            <div className="h-2 bg-[#d8daf7] rounded-full overflow-hidden">
              <div className="h-full bg-[#615fe2] rounded-full" style={{ width: '66%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 no-scrollbar">

        {/* Title */}
        <motion.h1
          className="text-[30px] font-bold text-[#2c3149] leading-tight mb-2"
          style={{ fontFamily: 'var(--font-plus-jakarta)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Scegli il tuo avatar
        </motion.h1>
        <motion.p
          className="text-sm text-[#595e78] mb-8"
          style={{ fontFamily: 'var(--font-plus-jakarta)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          Personalizza la tua esperienza scegliendo{'\n'}l&apos;avatar perfetto per te
        </motion.p>

        {/* Large circular preview */}
        <motion.div
          className="self-center mx-auto mb-8 relative"
          style={{ width: 200, height: 200 }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div
            className="w-full h-full rounded-full overflow-hidden"
            style={{
              border: '3px solid #615fe2',
              backgroundColor: 'white',
              boxShadow: '0 8px 32px rgba(97,95,226,0.2)',
            }}
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

          {/* Checkmark badge */}
          <motion.div
            className="absolute flex items-center justify-center rounded-full bg-[#615fe2]"
            style={{
              width: 36, height: 36,
              bottom: 4, right: 4,
              boxShadow: '0 4px 12px rgba(97,95,226,0.4)',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M1.5 6L6 10.5L14.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </motion.div>

        {/* Avatar grid — 4 columns */}
        <motion.div
          ref={scrollRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <div
            className="grid justify-items-center"
            style={{
              gridTemplateColumns: 'repeat(4, 68px)',
              columnGap: 12,
              rowGap: 16,
              justifyContent: 'center',
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
                    width: 68,
                    height: 68,
                    backgroundColor: 'white',
                    border: isSelected ? '2.5px solid #615fe2' : '2.5px solid rgba(172,176,206,0.4)',
                    boxShadow: isSelected
                      ? '0 0 0 3px rgba(97,95,226,0.15)'
                      : '0 2px 6px rgba(0,0,0,0.08)',
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
                    sizes="68px"
                    loading="lazy"
                    quality={60}
                  />
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Fixed bottom button */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-6 pb-6 pt-12"
        style={{
          background: 'linear-gradient(to top, #eef0ff 60%, rgba(238,240,255,0.9) 80%, transparent 100%)',
        }}
      >
        <motion.button
          onClick={handleContinue}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-[24px] font-bold text-white text-base"
          style={{
            fontFamily: 'var(--font-plus-jakarta)',
            backgroundColor: '#615fe2',
            filter: 'drop-shadow(0px 4px 7px rgba(74,75,215,0.39))',
          }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          Continua
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M10 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
