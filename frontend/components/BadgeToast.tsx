'use client';

import { useEffect, useState } from 'react';
import { BadgeDefinition, RARITY_COLORS } from '@/lib/badges';

interface BadgeToastProps {
  badge: BadgeDefinition;
  onDismiss: () => void;
}

export default function BadgeToast({ badge, onDismiss }: BadgeToastProps) {
  const [visible, setVisible] = useState(false);
  const colors = RARITY_COLORS[badge.rarity];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '-120%'})`,
        transition: 'transform 0.3s ease',
        zIndex: 99999,
        width: 'calc(100% - 32px)',
        maxWidth: '380px',
      }}
    >
      <div
        style={{
          background: '#1C2F43',
          border: `1px solid ${colors.border}`,
          borderRadius: '16px',
          padding: '16px',
          boxShadow: colors.glow !== 'none' ? colors.glow : '0 4px 24px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: colors.bg,
            border: `2px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            flexShrink: 0,
          }}
        >
          {badge.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '12px', color: '#3DD68C', fontWeight: 600, marginBottom: '2px' }}>
            Badge sbloccato!
          </p>
          <p style={{ fontSize: '15px', color: '#FFFFFF', fontWeight: 700, marginBottom: '2px' }}>
            {badge.name}
          </p>
          <p style={{ fontSize: '12px', color: '#8B8FA8', lineHeight: '1.3' }}>
            {badge.description}
          </p>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#8B8FA8" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
