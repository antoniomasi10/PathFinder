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
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: '#acb0ce' }} />
        </div>

        <div style={{ padding: '8px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
          {/* Nuova chat */}
          <button
            onClick={() => { onClose(); onNewChat(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 8px', borderRadius: 16, border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(97,95,226,0.1)',
            }}>
              <ChatDots size={24} color="#615fe2" />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: 15, color: '#2c3149', margin: 0 }}>
                {t.group.newChat}
              </p>
              <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 400, fontSize: 12, color: '#747995', margin: '2px 0 0' }}>
                {t.group.newChatDesc}
              </p>
            </div>
          </button>

          {/* Separator */}
          <div style={{ height: 1, backgroundColor: 'rgba(172,176,206,0.3)', margin: '0 8px' }} />

          {/* Crea gruppo */}
          <button
            onClick={() => { onClose(); onCreateGroup(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 8px', borderRadius: 16, border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(97,95,226,0.1)',
            }}>
              <UsersGroup size={24} color="#615fe2" />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: 15, color: '#2c3149', margin: 0 }}>
                {t.networking.createGroup}
              </p>
              <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 400, fontSize: 12, color: '#747995', margin: '2px 0 0' }}>
                {t.group.createGroupDesc}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
