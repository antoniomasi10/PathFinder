'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/lib/language';
import { ChatDots, UsersGroup } from '@/components/icons';

interface ActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onCreateGroup: () => void;
}

export default function ActionMenu({ isOpen, onClose, onNewChat, onCreateGroup }: ActionMenuProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(44,49,73,0.35)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="animate-slide-up"
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: '0 -4px 32px rgba(44,49,73,0.12)',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.75rem', paddingBottom: '0.25rem' }}>
          <div style={{ width: '2.5rem', height: '0.25rem', borderRadius: '624.9375rem', backgroundColor: '#acb0ce' }} />
        </div>

        <div style={{ padding: '0.5rem 1rem calc(env(safe-area-inset-bottom, 0rem) + 1.5rem)' }}>
          {/* Nuova chat */}
          <button
            onClick={() => { onClose(); onNewChat(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.875rem 0.5rem', borderRadius: '1rem', border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: '3rem', height: '3rem', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(97,95,226,0.1)',
            }}>
              <ChatDots size={24} color="#615fe2" />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: '0.9375rem', color: '#2c3149', margin: 0 }}>
                {t.group.newChat}
              </p>
              <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 400, fontSize: '0.75rem', color: '#747995', margin: '0.125rem 0 0' }}>
                {t.group.newChatDesc}
              </p>
            </div>
          </button>

          {/* Separator */}
          <div style={{ height: 1, backgroundColor: 'rgba(172,176,206,0.3)', margin: '0 0.5rem' }} />

          {/* Crea gruppo */}
          <button
            onClick={() => { onClose(); onCreateGroup(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.875rem 0.5rem', borderRadius: '1rem', border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: '3rem', height: '3rem', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(97,95,226,0.1)',
            }}>
              <UsersGroup size={24} color="#615fe2" />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: '0.9375rem', color: '#2c3149', margin: 0 }}>
                {t.networking.createGroup}
              </p>
              <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 400, fontSize: '0.75rem', color: '#747995', margin: '0.125rem 0 0' }}>
                {t.group.createGroupDesc}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
