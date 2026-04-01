'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeDefinition, RARITY_COLORS, RARITY_LABELS } from '@/lib/badges';
import { CloseLg } from '@/components/icons';

interface BadgeUnlockModalProps {
  badge: BadgeDefinition;
  onDismiss: () => void;
}

export default function BadgeUnlockModal({ badge, onDismiss }: BadgeUnlockModalProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const colors = RARITY_COLORS[badge.rarity];
  const isSpecial = badge.rarity === 'rara' || badge.rarity === 'epica' || badge.rarity === 'leggendaria';

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('visible'));
    });
  }, []);

  const close = () => {
    setPhase('exit');
    setTimeout(onDismiss, 280);
  };

  const goToAchievements = () => {
    close();
    setTimeout(() => router.push('/profile'), 300);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          transition: 'opacity 0.25s ease',
          opacity: phase === 'visible' ? 1 : 0,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#0D1117',
          border: `2px solid ${colors.border}`,
          borderRadius: '20px',
          padding: '32px 24px 28px',
          maxWidth: '340px',
          width: '100%',
          textAlign: 'center',
          boxShadow: `0 8px 32px rgba(108,99,255,0.3), ${colors.glow}`,
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease',
          transform: phase === 'visible' ? 'scale(1)' : 'scale(0.85)',
          opacity: phase === 'exit' ? 0 : phase === 'visible' ? 1 : 0,
        }}
      >
        {/* Close */}
        <button
          onClick={close}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          <CloseLg size={22} strokeWidth={2} color="#8B8FA8" />
        </button>

        {/* Celebration emojis */}
        <div
          style={{
            fontSize: '28px',
            marginBottom: '12px',
            transition: 'opacity 0.3s ease 0.15s, transform 0.4s ease 0.15s',
            opacity: phase === 'visible' ? 1 : 0,
            transform: phase === 'visible' ? 'translateY(0)' : 'translateY(-10px)',
          }}
        >
          {isSpecial ? '\u{1F389} \u{1F389} \u{1F389}' : '\u{1F389}'}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: '20px',
            transition: 'opacity 0.3s ease 0.2s',
            opacity: phase === 'visible' ? 1 : 0,
          }}
        >
          Badge Sbloccato!
        </h2>

        {/* Badge icon */}
        <div
          style={{
            width: '110px',
            height: '110px',
            borderRadius: '24px',
            background: colors.bg,
            border: `3px solid ${colors.border}`,
            boxShadow: colors.glow,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.25s, opacity 0.3s ease 0.25s',
            transform: phase === 'visible' ? 'scale(1)' : 'scale(0)',
            opacity: phase === 'visible' ? 1 : 0,
          }}
        >
          <span style={{ transform: 'scale(2.5)', display: 'flex' }}>{badge.icon}</span>
        </div>

        {/* Badge name */}
        <h3
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#FFFFFF',
            marginBottom: '6px',
            transition: 'opacity 0.3s ease 0.35s',
            opacity: phase === 'visible' ? 1 : 0,
          }}
        >
          {badge.name}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: '14px',
            color: '#D0D4DC',
            lineHeight: '1.5',
            marginBottom: '8px',
            maxWidth: '260px',
            marginLeft: 'auto',
            marginRight: 'auto',
            transition: 'opacity 0.3s ease 0.4s',
            opacity: phase === 'visible' ? 1 : 0,
          }}
        >
          {badge.description}
        </p>

        {/* Rarity */}
        <div
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#FFFFFF',
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            marginBottom: '24px',
            transition: 'opacity 0.3s ease 0.45s',
            opacity: phase === 'visible' ? 1 : 0,
          }}
        >
          {RARITY_LABELS[badge.rarity]}
        </div>

        {/* CTA */}
        <button
          onClick={goToAchievements}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '260px',
            margin: '0 auto',
            padding: '14px',
            borderRadius: '12px',
            backgroundColor: '#6C63FF',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(108,99,255,0.3)',
            transition: 'opacity 0.3s ease 0.5s, background-color 0.2s',
            opacity: phase === 'visible' ? 1 : 0,
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#5952E6'; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#6C63FF'; }}
        >
          Vai agli Achievement
        </button>
      </div>
    </div>
  );
}
