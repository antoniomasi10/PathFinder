'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSavedOpportunities } from '@/lib/savedOpportunities';
import api from '@/lib/api';

// ─── Context for triggering the prompt check from anywhere ───────────────────

interface SkillsPromptContextType {
  /** Call after an event that might trigger the skills prompt (e.g. save opportunity) */
  checkPrompt: () => void;
}

const SkillsPromptContext = createContext<SkillsPromptContextType>({ checkPrompt: () => {} });

export function useSkillsPrompt() {
  return useContext(SkillsPromptContext);
}

// ─── Centered popup component ───────────────────────────────────────────────

function SkillsPopup({ onDefine, onDismiss }: { onDefine: () => void; onDismiss: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('visible'));
    });
  }, []);

  const close = useCallback((cb: () => void) => {
    setPhase('exit');
    setTimeout(cb, 300);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99998,
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => close(onDismiss)}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(26, 29, 58, 0.8)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: 'opacity 0.3s ease',
          opacity: phase === 'visible' ? 1 : 0,
        }}
      />

      {/* Popup */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#1e2139',
          borderRadius: '24px',
          padding: '32px',
          width: '100%',
          maxWidth: '420px',
          border: '1px solid #2d3154',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
          transform: phase === 'visible' ? 'scale(1)' : phase === 'exit' ? 'scale(0.92)' : 'scale(0.88)',
          opacity: phase === 'visible' ? 1 : 0,
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 400,
            color: '#FFFFFF',
            marginBottom: '12px',
          }}
        >
          Definisci le tue competenze
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '14px',
            color: '#a1a4b8',
            lineHeight: '1.6',
            marginBottom: '32px',
          }}
        >
          Completa il tuo profilo con le tue competenze per ricevere opportunità più pertinenti e migliorare il matching con le proposte più adatte a te.
        </p>

        {/* Primary button */}
        <button
          onClick={() => close(onDefine)}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 24px',
            borderRadius: '12px',
            background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          Definisci ora
        </button>

        {/* Secondary button */}
        <button
          onClick={() => close(onDismiss)}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 24px',
            borderRadius: '12px',
            backgroundColor: '#2d3154',
            border: 'none',
            color: '#a1a4b8',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Ricordamelo dopo
        </button>
      </div>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export default function SkillsPromptProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { onSave } = useSavedOpportunities();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const shownThisSession = useRef(false);
  const checking = useRef(false);

  const checkPrompt = useCallback(async () => {
    if (!user?.id || shownThisSession.current || checking.current) return;
    checking.current = true;
    try {
      const { data } = await api.get(`/v1/users/${user.id}/skills/should-prompt`);
      if (data.shouldShow) {
        shownThisSession.current = true;
        setShow(true);
      }
    } catch {
      // silently ignore
    } finally {
      checking.current = false;
    }
  }, [user?.id]);

  // Check on session start (mount)
  useEffect(() => {
    if (user?.id) {
      checkPrompt();
    }
  }, [user?.id, checkPrompt]);

  // Check after user saves an opportunity
  useEffect(() => {
    return onSave(() => checkPrompt());
  }, [onSave, checkPrompt]);

  const handleDefine = useCallback(async () => {
    if (!user?.id) return;
    setShow(false);
    api.patch(`/v1/users/${user.id}/skills/prompt`, { action: 'shown' }).catch(() => {});
    router.push('/profile/skills');
  }, [user?.id, router]);

  const handleDismiss = useCallback(async () => {
    if (!user?.id) return;
    setShow(false);
    api.patch(`/v1/users/${user.id}/skills/prompt`, { action: 'dismissed' }).catch(() => {});
  }, [user?.id]);

  return (
    <SkillsPromptContext.Provider value={{ checkPrompt }}>
      {children}
      {show && <SkillsPopup onDefine={handleDefine} onDismiss={handleDismiss} />}
    </SkillsPromptContext.Provider>
  );
}
