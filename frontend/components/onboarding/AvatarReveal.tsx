'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getAvatar } from './avatarData';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ProfileData } from './onboarding-data';
import { CloseLg, ArrowRight } from '@/components/icons';

interface Props {
  avatarId: string;
  profileData: ProfileData;
}

type Phase = 'entering' | 'playing' | 'waiting';

export default function AvatarReveal({ avatarId, profileData }: Props) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasNavigated = useRef(false);

  const [phase, setPhase] = useState<Phase>('entering');
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showError, setShowError] = useState(false);
  const [exiting, setExiting] = useState(false);

  const avatar = getAvatar(avatarId);

  // --- Navigate to home ---
  const navigateToHome = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    if (user) setUser({ ...user, profileCompleted: true });
    router.replace('/home');
  }, [user, setUser, router]);

  // --- Parallel data loading ---
  const loadAppData = useCallback(async () => {
    try {
      await api.post('/profile/questionnaire', {
        ...profileData,
        avatarId: avatar.revealed,
      });

      await Promise.all([
        api.get('/opportunities?matched=true&limit=20').catch(() => {}),
        api.get('/notifications/unread-count').catch(() => {}),
      ]);

      localStorage.setItem('selected_avatar', avatarId);
      localStorage.setItem('onboarding_step', 'complete');
      setLoadingComplete(true);
    } catch (err: any) {
      console.error('[AvatarReveal] Loading error:', err);
      setErrorMsg(err.response?.data?.error || 'Errore di rete. Riprova.');
      setShowError(true);
    }
  }, [profileData, avatarId, avatar.revealed]);

  // --- Start loading on mount ---
  useEffect(() => {
    loadAppData();
  }, [loadAppData]);

  // --- Entrance animation done → start playing ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('playing');
    }, 2600); // after all entrance animations complete (~2.6s total)
    return () => clearTimeout(timer);
  }, []);

  // --- Video handlers ---
  const handleVideoEnd = useCallback(() => {
    setVideoFinished(true);
    setPhase('waiting');
  }, []);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
    setVideoFinished(true);
    setPhase('waiting');
  }, []);

  // --- Button press: exit + navigate ---
  const handleContinue = useCallback(() => {
    if (!loadingComplete || exiting) return;
    if (navigator.vibrate) navigator.vibrate([10, 50, 20]);
    setExiting(true);
    setTimeout(navigateToHome, 700);
  }, [loadingComplete, exiting, navigateToHome]);

  const handleRetry = useCallback(() => {
    setErrorMsg('');
    setShowError(false);
    setLoadingComplete(false);
    loadAppData();
  }, [loadAppData]);

  // --- Timeout fallback ---
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasNavigated.current && !showError) {
        navigateToHome();
      }
    }, 30000); // 30s generous timeout since user must press button
    return () => clearTimeout(timeout);
  }, [navigateToHome, showError]);

  // --- Error state ---
  if (showError) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0D1117 0%, #1A1F2E 100%)' }}
      >
        <motion.div
          className="flex flex-col items-center gap-4 px-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
            <CloseLg size={40} color="#FF4444" strokeWidth={2} />
          </div>
          <p className="text-white text-lg font-semibold">Qualcosa è andato storto</p>
          <p className="text-white/60 text-sm">{errorMsg}</p>
          <button
            onClick={handleRetry}
            className="mt-4 px-8 py-3 rounded-full text-white font-semibold"
            style={{ backgroundColor: '#6C63FF' }}
          >
            Riprova
          </button>
        </motion.div>
      </div>
    );
  }

  const buttonReady = loadingComplete && (videoFinished || videoError);

  // --- Main reveal screen ---
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0D1117 0%, #1A1F2E 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: exiting ? 0.6 : 0.8, ease: [0.25, 0.1, 0.25, 1] as const }}
      aria-label="Avatar reveal animation"
    >
      {/* Ambient blobs — CSS-only for better performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[60px] animate-blob-1"
          style={{
            background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
            top: '-15%',
            left: '-15%',
            willChange: 'transform',
          }}
        />
        <div
          className="absolute w-[350px] h-[350px] rounded-full opacity-15 blur-[60px] animate-blob-2"
          style={{
            background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
            bottom: '-10%',
            right: '-15%',
            willChange: 'transform',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full px-6">

        {/* Title section */}
        <div className="text-center mb-10">
          <motion.h1
            className="text-[28px] font-bold text-white leading-tight"
            style={{ letterSpacing: '-0.5px' }}
            role="heading"
            aria-level={1}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
          >
            Preparati a scoprire{'\n'}la tua strada
          </motion.h1>
          <motion.p
            className="text-base mt-3 leading-relaxed mx-auto"
            style={{ color: '#8B8FA8', maxWidth: '80%' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
          >
            Il tuo viaggio inizia qui. Il tuo avatar è pronto a guidarti.
          </motion.p>
        </div>

        {/* Avatar circle with glow */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.7, y: -60 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            delay: 0.4,
            opacity: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const },
            scale: { type: 'spring' as const, stiffness: 30, damping: 10, mass: 1 },
            y: { duration: 1.0, ease: [0.25, 0.1, 0.25, 1] as const },
          }}
          aria-label="Il tuo avatar personalizzato"
        >
          {/* Pulsing glow — CSS-only */}
          <div
            className="absolute inset-0 rounded-full animate-glow-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(108,99,255,0.25) 0%, transparent 70%)',
              transform: 'scale(1.3)',
            }}
          />

          {/* Decorative floating dots — CSS-only */}
          <div
            className="absolute rounded-full animate-float-dot-1"
            style={{
              width: 10,
              height: 10,
              backgroundColor: '#6C63FF',
              opacity: 0.5,
              top: '10%',
              right: '-8%',
              willChange: 'transform',
            }}
          />
          <div
            className="absolute rounded-full animate-float-dot-2"
            style={{
              width: 6,
              height: 6,
              backgroundColor: '#8b5cf6',
              opacity: 0.4,
              bottom: '15%',
              left: '-5%',
              willChange: 'transform',
            }}
          />

          {/* Avatar container */}
          <div
            className="rounded-full overflow-hidden relative"
            style={{
              width: 'min(80vw, 300px)',
              height: 'min(80vw, 300px)',
              boxShadow: '0 0 40px rgba(108,99,255,0.2)',
            }}
          >
            {!videoError ? (
              <video
                ref={videoRef}
                src={avatar.video}
                className="w-full h-full object-cover"
                preload="auto"
                autoPlay
                muted
                playsInline
                onEnded={handleVideoEnd}
                onError={handleVideoError}
                aria-label="Animazione rivelazione avatar"
              />
            ) : (
              <div className="w-full h-full relative bg-white">
                <Image
                  src={avatar.revealed}
                  alt="Avatar rivelato"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom section — button + progress dots */}
      <div className="relative z-10 w-full px-6 pb-10">
        {/* Button */}
        <motion.button
          onClick={handleContinue}
          disabled={!buttonReady}
          className="w-full flex items-center justify-center gap-2 text-white font-semibold"
          style={{
            height: 56,
            borderRadius: 28,
            fontSize: 17,
            background: buttonReady ? '#6C63FF' : 'rgba(108,99,255,0.4)',
            boxShadow: buttonReady ? '0 4px 20px rgba(108,99,255,0.3)' : 'none',
            cursor: buttonReady ? 'pointer' : 'default',
            transition: 'background 0.3s, box-shadow 0.3s',
          }}
          initial={{ opacity: 0, y: 120 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
          whileHover={buttonReady ? { scale: 1.02, boxShadow: '0 6px 28px rgba(108,99,255,0.45)' } : {}}
          whileTap={buttonReady ? { scale: 0.95 } : {}}
          aria-label="Inizia l'esplorazione"
          aria-disabled={!buttonReady}
        >
          {!buttonReady ? (
            <motion.div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.4s' }} />
            </motion.div>
          ) : (
            <>
              Inizia l&apos;esplorazione
              <ArrowRight size={18} strokeWidth={2.5} />
            </>
          )}
        </motion.button>

      </div>
    </motion.div>
  );
}
