'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getAvatar } from './avatarData';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ProfileData } from './onboarding-data';
import { ArrowRight } from '@/components/icons';

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

  const navigateToHome = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    if (user) setUser({ ...user, profileCompleted: true });
    router.replace('/home');
  }, [user, setUser, router]);

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

  useEffect(() => { loadAppData(); }, [loadAppData]);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('playing'), 2600);
    return () => clearTimeout(timer);
  }, []);

  const handleVideoEnd = useCallback(() => {
    setVideoFinished(true);
    setPhase('waiting');
  }, []);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
    setVideoFinished(true);
    setPhase('waiting');
  }, []);

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

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasNavigated.current && !showError) navigateToHome();
    }, 30000);
    return () => clearTimeout(timeout);
  }, [navigateToHome, showError]);

  const buttonReady = loadingComplete && (videoFinished || videoError);

  // --- Error screen ---
  if (showError) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 font-jakarta"
        style={{ background: '#eef0ff' }}
      >
        <div
          className="flex flex-col items-center gap-4 text-center p-8 rounded-[24px]"
          style={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-[#2c3149] text-lg font-bold" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
            Qualcosa è andato storto
          </p>
          <p className="text-[#595e78] text-sm" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
            {errorMsg}
          </p>
          <button
            onClick={handleRetry}
            className="mt-2 px-8 py-3 rounded-[24px] text-white font-semibold"
            style={{ backgroundColor: '#615fe2', fontFamily: 'var(--font-plus-jakarta)' }}
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  // --- Main reveal screen ---
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-hidden font-jakarta"
      style={{ background: '#eef0ff' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: exiting ? 0.6 : 0.8, ease: [0.25, 0.1, 0.25, 1] as const }}
      aria-label="Avatar reveal animation"
    >
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full px-6">

        {/* Title */}
        <div className="text-center mb-10">
          <motion.h1
            className="text-[28px] font-bold text-[#2c3149] leading-tight"
            style={{ fontFamily: 'var(--font-plus-jakarta)', letterSpacing: '-0.3px' }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
          >
            Preparati a scoprire{'\n'}la tua strada
          </motion.h1>
          <motion.p
            className="text-base mt-3 leading-relaxed mx-auto text-[#595e78]"
            style={{ fontFamily: 'var(--font-plus-jakarta)', maxWidth: '80%' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
          >
            Il tuo viaggio inizia qui. Il tuo avatar è pronto a guidarti.
          </motion.p>
        </div>

        {/* Avatar circle */}
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
          {/* Soft glow ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(97,95,226,0.18) 0%, transparent 70%)',
              transform: 'scale(1.35)',
            }}
          />

          {/* Floating dots */}
          <div
            className="absolute rounded-full animate-float-dot-1"
            style={{ width: 10, height: 10, backgroundColor: '#b0b3f0', opacity: 0.7, top: '8%', right: '-8%' }}
          />
          <div
            className="absolute rounded-full animate-float-dot-2"
            style={{ width: 6, height: 6, backgroundColor: '#615fe2', opacity: 0.4, bottom: '12%', left: '-5%' }}
          />

          {/* Video/image container */}
          <div
            className="rounded-full overflow-hidden relative"
            style={{
              width: 'min(80vw, 300px)',
              height: 'min(80vw, 300px)',
              border: '3px solid #615fe2',
              backgroundColor: 'white',
              boxShadow: '0 8px 40px rgba(97,95,226,0.2)',
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
                <Image src={avatar.revealed} alt="Avatar rivelato" fill className="object-cover" priority />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom button */}
      <div className="relative z-10 w-full px-6 pb-10">
        <motion.button
          onClick={handleContinue}
          disabled={!buttonReady}
          className="w-full flex items-center justify-center gap-2 font-bold text-white text-base"
          style={{
            height: 56,
            borderRadius: 28,
            fontFamily: 'var(--font-plus-jakarta)',
            backgroundColor: '#615fe2',
            opacity: buttonReady ? 1 : 0.5,
            filter: buttonReady ? 'drop-shadow(0px 4px 7px rgba(74,75,215,0.39))' : 'none',
            cursor: buttonReady ? 'pointer' : 'default',
            transition: 'opacity 0.3s, filter 0.3s',
          }}
          initial={{ opacity: 0, y: 120 }}
          animate={{ opacity: buttonReady ? 1 : 0.5, y: 0 }}
          transition={{ delay: 1.8, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
          whileHover={buttonReady ? { scale: 1.01 } : {}}
          whileTap={buttonReady ? { scale: 0.97 } : {}}
          aria-label="Inizia l'esplorazione"
          aria-disabled={!buttonReady}
        >
          {!buttonReady ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-white/70 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full bg-white/70 animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
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
