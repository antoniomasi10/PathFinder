'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { isValidImageUrl } from '@/lib/urlValidation';

interface Conversation {
  user: { id: string; name: string; avatar?: string; avatarBgColor?: string };
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
}

export default function ShareOpportunityModal({ isOpen, onClose, opportunityId, opportunityTitle }: Props) {
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  const handleClose = useCallback((fromPopState = false) => {
    if (!fromPopState) window.history.back();
    setSearch('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ modal: 'shareOpportunity' }, '');
    const handlePopState = () => handleClose(true);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.get('/messages/conversations?limit=50')
      .then(({ data }) => setConversations(data.data || []))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleShare = async (receiverId: string) => {
    if (sending) return;
    setSending(true);
    try {
      await api.post('/messages', {
        receiverId,
        type: 'opportunity',
        opportunityId,
      });
      handleClose();
      showToast('Opportunità condivisa', 'success');
    } catch {
      showToast('Errore nell\'invio', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      onClick={() => handleClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(44,49,73,0.45)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        padding: 16,
        fontFamily: 'var(--font-plus-jakarta)',
      }}
    >
      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          maxHeight: '80vh',
          backgroundColor: '#fbf8ff',
          borderRadius: 24,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(44,49,73,0.18)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 16px 16px 20px',
          borderBottom: '1px solid rgba(172,176,206,0.2)',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 17, color: '#2c3149', margin: 0 }}>Condividi con...</p>
            <p style={{ fontSize: 12, color: '#acb0ce', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opportunityTitle}
            </p>
          </div>
          <button
            onClick={() => handleClose()}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              backgroundColor: 'rgba(172,176,206,0.15)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            aria-label="Chiudi"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="#595e78" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '10px 16px 4px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(172,176,206,0.12)',
            borderRadius: 12, padding: '8px 12px',
            border: '1px solid rgba(172,176,206,0.2)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="6.5" cy="6.5" r="5" stroke="#acb0ce" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="#acb0ce" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Cerca una persona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none',
                backgroundColor: 'transparent',
                fontSize: 14, color: '#2c3149',
                fontFamily: 'var(--font-plus-jakarta)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="#acb0ce" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 12px' }}>
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#e4e7ff', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, backgroundColor: '#e4e7ff', borderRadius: 6, width: '45%', marginBottom: 6 }} />
                  <div style={{ height: 11, backgroundColor: '#e4e7ff', borderRadius: 6, width: '70%' }} />
                </div>
              </div>
            ))
          ) : (() => {
            const filtered = conversations.filter((c) =>
              c.user.name.toLowerCase().includes(search.toLowerCase())
            );
            if (conversations.length === 0) return (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#acb0ce' }}>
                <p style={{ fontSize: 14, margin: 0 }}>Non hai ancora conversazioni</p>
              </div>
            );
            if (filtered.length === 0) return (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#acb0ce' }}>
                <p style={{ fontSize: 14, margin: 0 }}>Nessun risultato per &ldquo;{search}&rdquo;</p>
              </div>
            );
            return filtered.map((conv) => {
              const u = conv.user;
              return (
                <button
                  key={u.id}
                  onClick={() => handleShare(u.id)}
                  disabled={sending}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 8px', borderRadius: 16, border: 'none',
                    cursor: sending ? 'not-allowed' : 'pointer', textAlign: 'left',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.15s',
                    opacity: sending ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => { if (!sending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(97,95,226,0.05)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    overflow: 'hidden', backgroundColor: u.avatarBgColor || 'rgba(97,95,226,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {u.avatar && isValidImageUrl(u.avatar) ? (
                      <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#615fe2' }}>{u.name[0]}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: '#2c3149', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name}
                    </p>
                    <p style={{ fontSize: 12, color: '#acb0ce', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.lastMessage || 'Nessun messaggio'}
                    </p>
                  </div>

                  {/* Send icon */}
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M17.5 10L3.5 3.5L6.5 10L3.5 16.5L17.5 10Z" stroke="#615fe2" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
