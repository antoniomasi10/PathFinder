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
  profileData: ProfileData;
}

const MIN_ANIMATION_MS = 3000;
const NAVIGATION_TIMEOUT_MS = 10000;

// --- Transition variants ---

// Entrance: screen fades in (400ms), video scales from 0.8→1.0 with spring
const screenEnterVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  },
};

const videoEnterVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      opacity: { duration: 0.3 },
      scale: { type: 'spring' as const, tension: 50, friction: 7, mass: 1 },
    },
  },
};

// Exit: video scales to 0.9 and fades out (400ms parallel)
const videoExitVariants = {
  scale: 0.9,
  opacity: 0,
  transition: {
    duration: 0.4,
    ease: [0.33, 0, 0.67, 1] as const, // ease-out cubic
  },
};

export default function AvatarReveal({ avatarId, profileData }: Props) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasNavigated = useRef(false);

  const [loadingComplete, setLoadingComplete] = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showError, setShowError] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [exiting, setExiting] = useState(false);

  const avatar = getAvatar(avatarId);

  // Animation is complete when BOTH video finished AND min time passed
  const animationComplete = (videoFinished || videoError) && minTimePassed;

  console.log('[AvatarReveal] Mounted:', { avatarId, video: avatar.video });

  // --- Navigate to home (called once, AFTER exit animation) ---
  const navigateToHome = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    console.log('[AvatarReveal] >>> Navigating to /home');
    if (user) setUser({ ...user, profileCompleted: true });
    router.replace('/home');
  }, [user, setUser, router]);

  // --- Start exit animation, then navigate ---
  const startExit = useCallback(() => {
    if (exiting) return;
    console.log('[AvatarReveal] Starting exit animation');
    setExiting(true);
    // Navigate AFTER exit animation completes (400ms fade + small buffer)
    setTimeout(navigateToHome, 500);
  }, [exiting, navigateToHome]);

  // --- Parallel data loading ---
  const loadAppData = useCallback(async () => {
    console.log('[AvatarReveal] Loading started');
    try {
      // Save profile + avatar as revealed image path
      await api.post('/profile/questionnaire', {
        ...profileData,
        avatarId: avatar.revealed,
      });
      console.log('[AvatarReveal] Profile saved with avatar:', avatar.revealed);

      // Parallel: preload home data
      await Promise.all([
        api.get('/opportunities?matched=true&limit=20').catch(() => {}),
        api.get('/notifications/unread-count').catch(() => {}),
      ]);
      console.log('[AvatarReveal] App data preloaded');

      // Save to localStorage for resume support
      localStorage.setItem('selected_avatar', avatarId);
      localStorage.setItem('onboarding_step', 'complete');

      console.log('[AvatarReveal] Loading complete');
      setLoadingComplete(true);
    } catch (err: any) {
      console.error('[AvatarReveal] Loading error:', err);
      setErrorMsg(err.response?.data?.error || 'Errore di rete. Riprova.');
      setShowError(true);
    }
  }, [profileData, avatarId, avatar.revealed]);

  // --- Start loading + min timer on mount ---
  useEffect(() => {
    loadAppData();

    const minTimer = setTimeout(() => {
      console.log('[AvatarReveal] Min animation time (3s) reached');
      setMinTimePassed(true);
    }, MIN_ANIMATION_MS);

    const loaderTimer = setTimeout(() => {
      setShowLoader(true);
    }, 5000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(loaderTimer);
    };
  }, [loadAppData]);

  // --- When both animation + loading done → start exit animation ---
  useEffect(() => {
    console.log('[AvatarReveal] State check:', {
      animationComplete,
      loadingComplete,
      videoFinished,
      minTimePassed,
      showError,
      exiting,
    });

    if (!animationComplete || showError || exiting) return;

    if (loadingComplete) {
      console.log('[AvatarReveal] Both complete → starting exit animation');
      startExit();
    } else {
      console.log('[AvatarReveal] Animation done, waiting for loading...');
    }
  }, [animationComplete, loadingComplete, showError, exiting, startExit, videoFinished, minTimePassed]);

  // --- Timeout fallback ---
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasNavigated.current && !showError) {
        console.warn('[AvatarReveal] Timeout after', NAVIGATION_TIMEOUT_MS, 'ms — forcing navigation');
        navigateToHome();
      }
    }, NAVIGATION_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [navigateToHome, showError]);

  // --- Video ended: mark finished, loop if loading still pending ---
  const handleVideoEnd = useCallback(() => {
    console.log('[AvatarReveal] Video ended naturally. loadingComplete:', loadingComplete);
    setVideoFinished(true);

    if (!loadingComplete && videoRef.current) {
      console.log('[AvatarReveal] Looping video while waiting for loading');
      videoRef.current.currentTime = Math.max(0, videoRef.current.duration - 0.5);
      videoRef.current.play().catch(() => {});
    }
  }, [loadingComplete]);

  const handleVideoError = useCallback(() => {
    console.warn('[AvatarReveal] Video error — falling back to static crossfade');
    setVideoError(true);
  }, []);

  const handleRetry = useCallback(() => {
    console.log('[AvatarReveal] Retrying...');
    setErrorMsg('');
    setShowError(false);
    setLoadingComplete(false);
    loadAppData();
  }, [loadAppData]);

  // --- Error state ---
  if (showError) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#0F172A' }}
      >
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
      </div>
    );
  }

  // --- Main reveal with entrance/exit transitions ---
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#0F172A' }}
      variants={screenEnterVariants}
      initial="hidden"
      animate={exiting ? 'exit' : 'visible'}
      aria-label="Avatar reveal animation in progress"
    >
      {/* Blurred faux-app background matching the real app theme */}
      <div className="absolute inset-0 overflow-hidden" style={{ filter: 'blur(24px)', opacity: 0.5 }}>
        <div className="absolute top-0 left-0 right-0 h-14" style={{ backgroundColor: '#1E293B' }} />
        <div className="absolute top-20 left-4 right-4 space-y-3">
          <div className="h-32 rounded-2xl" style={{ backgroundColor: '#1E293B' }} />
          <div className="h-32 rounded-2xl" style={{ backgroundColor: '#1E293B' }} />
          <div className="h-32 rounded-2xl" style={{ backgroundColor: '#1E293B' }} />
          <div className="h-32 rounded-2xl" style={{ backgroundColor: '#1E293B' }} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16" style={{ backgroundColor: '#1E293B' }} />
      </div>

      {/* Subtle radial overlay for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.7) 60%, rgba(15,23,42,0.9) 100%)',
        }}
      />

      {/* Video container — spring scale-in entrance, scale+fade exit */}
      <motion.div
        className="relative flex items-center justify-center rounded-full overflow-hidden"
        style={{
          width: 'min(80vw, 360px)',
          height: 'min(80vw, 360px)',
        }}
        variants={videoEnterVariants}
        initial="hidden"
        animate={exiting ? videoExitVariants : 'visible'}
      >
        {!videoError ? (
          <video
            ref={videoRef}
            src={avatar.video}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            aria-label="Animazione rivelazione avatar"
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={minTimePassed ? 'revealed' : 'blind'}
              className="w-full h-full relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Image
                src={minTimePassed ? avatar.revealed : avatar.blindfolded}
                alt="Avatar"
                fill
                className="object-cover"
                priority
              />
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>

      {/* Subtle loading indicator */}
      <AnimatePresence>
        {((showLoader && !loadingComplete) || (animationComplete && !loadingComplete)) && !exiting && (
          <motion.div
            className="absolute bottom-20 flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.4s' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
