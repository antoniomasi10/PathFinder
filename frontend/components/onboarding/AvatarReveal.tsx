'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getAvatar } from './avatarData';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ProfileData } from './onboarding-data';

interface Props {
  avatarId: string;
  bgColor: string;
  profileData: ProfileData;
}

type Phase = 'enter' | 'video' | 'celebration' | 'exit' | 'error';

const MIN_ANIMATION_MS = 3000;

export default function AvatarReveal({ avatarId, bgColor, profileData }: Props) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [phase, setPhase] = useState<Phase>('enter');
  const [loadingDone, setLoadingDone] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLoader, setShowLoader] = useState(false);

  const avatar = getAvatar(avatarId);
  const bothDone = loadingDone && animationDone;

  // --- Parallel data loading ---
  const loadAppData = useCallback(async () => {
    try {
      // Save profile + avatar selection
      await api.post('/profile/questionnaire', {
        ...profileData,
        avatarId,
        avatarBgColor: bgColor,
      });

      // Parallel: fetch opportunities + preload home assets
      await Promise.all([
        api.get('/opportunities?matched=true&limit=20').catch(() => {}),
        api.get('/notifications/unread-count').catch(() => {}),
      ]);

      // Save to localStorage for resume support
      localStorage.setItem('selected_avatar', avatarId);
      localStorage.setItem('selected_bg', bgColor);
      localStorage.setItem('onboarding_step', 'complete');

      setLoadingDone(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Errore di rete. Riprova.');
      setPhase('error');
    }
  }, [profileData, avatarId, bgColor]);

  // --- Start loading + animation timer on mount ---
  useEffect(() => {
    loadAppData();

    // Minimum animation duration
    const timer = setTimeout(() => {
      setAnimationDone(true);
    }, MIN_ANIMATION_MS);

    // Show subtle loader if loading takes > 5 seconds
    const loaderTimer = setTimeout(() => {
      setShowLoader(true);
    }, 5000);

    // Transition from enter to video phase
    const enterTimer = setTimeout(() => {
      setPhase('video');
    }, 800);

    return () => {
      clearTimeout(timer);
      clearTimeout(loaderTimer);
      clearTimeout(enterTimer);
    };
  }, [loadAppData]);

  // --- When both done, proceed to celebration & exit ---
  useEffect(() => {
    if (!bothDone || phase === 'error') return;

    setPhase('celebration');

    const celebrationTimer = setTimeout(() => {
      setPhase('exit');
    }, 600);

    const exitTimer = setTimeout(() => {
      // Update auth state
      if (user) setUser({ ...user, profileCompleted: true });
      router.replace('/home');
    }, 1500);

    return () => {
      clearTimeout(celebrationTimer);
      clearTimeout(exitTimer);
    };
  }, [bothDone, phase, user, setUser, router]);

  // --- Video ended handler ---
  const handleVideoEnd = useCallback(() => {
    // If loading isn't done yet, loop the video
    if (!loadingDone && videoRef.current) {
      videoRef.current.currentTime = videoRef.current.duration - 0.5;
      videoRef.current.play().catch(() => {});
    }
  }, [loadingDone]);

  // --- Video error: fallback to static crossfade ---
  const handleVideoError = useCallback(() => {
    setVideoError(true);
  }, []);

  // --- Retry on error ---
  const handleRetry = useCallback(() => {
    setErrorMsg('');
    setPhase('video');
    loadAppData();
  }, [loadAppData]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: bgColor }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Error state */}
      {phase === 'error' && (
        <motion.div
          className="flex flex-col items-center gap-4 px-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-white text-lg font-semibold">Qualcosa è andato storto</p>
          <p className="text-white/60 text-sm">{errorMsg}</p>
          <button
            onClick={handleRetry}
            className="mt-4 px-8 py-3 rounded-xl text-white font-semibold"
            style={{ backgroundColor: '#6C63FF' }}
          >
            Riprova
          </button>
        </motion.div>
      )}

      {/* Main reveal content */}
      {phase !== 'error' && (
        <>
          <motion.div
            className="relative"
            style={{ width: '80vw', maxWidth: 400, aspectRatio: '1/1' }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={
              phase === 'exit'
                ? { scale: 0.15, opacity: 0, x: '35vw', y: '-40vh' }
                : phase === 'celebration'
                  ? { scale: 1, opacity: 1, y: [0, -15, 0] }
                  : { scale: 1, opacity: 1 }
            }
            transition={
              phase === 'exit'
                ? { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
                : phase === 'celebration'
                  ? { y: { duration: 0.5, ease: 'easeInOut' }, scale: { duration: 0.3 } }
                  : { duration: 0.5, ease: [0, 0, 0.2, 1] }
            }
          >
            {/* Video reveal or static fallback */}
            {!videoError && phase !== 'enter' ? (
              <video
                ref={videoRef}
                src={avatar.video}
                className="w-full h-full object-contain rounded-3xl"
                autoPlay
                muted
                playsInline
                onEnded={handleVideoEnd}
                onError={handleVideoError}
                aria-label="Animazione rivelazione avatar"
              />
            ) : (
              /* Static image fallback / enter phase */
              <AnimatePresence mode="wait">
                <motion.div
                  key={animationDone && phase !== 'enter' ? 'revealed' : 'blind'}
                  className="w-full h-full relative rounded-3xl overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <Image
                    src={
                      animationDone && phase !== 'enter'
                        ? avatar.revealed
                        : avatar.blindfolded
                    }
                    alt="Avatar"
                    fill
                    className="object-contain"
                    priority
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>

          {/* Subtle loading indicator (only if loading > 5s) */}
          <AnimatePresence>
            {showLoader && !loadingDone && (
              <motion.div
                className="mt-8 flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.4s' }} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
