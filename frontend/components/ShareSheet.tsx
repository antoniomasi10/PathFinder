'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { isValidImageUrl } from '@/lib/urlValidation';
import { Share, PaperPlane } from '@/components/icons';

interface Friend {
  id: string;
  name: string;
  surname: string;
  avatar?: string;
  avatarBgColor?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  opportunityDescription?: string;
}

export default function ShareSheet({ isOpen, onClose, opportunityId, opportunityTitle, opportunityDescription }: Props) {
  const { showToast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const [mounted, setMounted] = useState(false);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleClose = useCallback((fromPopState = false) => {
    if (!fromPopState) window.history.back();
    setPhase('exit');
    setTimeout(() => {
      setMounted(false);
      setSearch('');
      onClose();
    }, 320);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setMounted(true);
    setPhase('enter');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('visible'));
    });
    window.history.pushState({ modal: 'shareSheet' }, '');
    const handlePopState = () => handleClose(true);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [mounted]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.get('/friends')
      .then(({ data }) => setFriends(data || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleExternalShare = async () => {
    const appUrl = `${window.location.origin}/opportunities/${opportunityId}`;
    if (canNativeShare) {
      try {
        await navigator.share({
          title: opportunityTitle,
          text: opportunityDescription ? `${opportunityTitle}\n${opportunityDescription}` : opportunityTitle,
          url: appUrl,
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') showToast('Errore nella condivisione', 'error');
      }
    } else {
      try {
        await navigator.clipboard.writeText(appUrl);
        showToast('Link copiato negli appunti', 'success');
      } catch {
        showToast('Impossibile copiare il link', 'error');
      }
    }
  };

  const handleShareWithFriend = async (receiverId: string) => {
    if (sending) return;
    setSending(true);
    try {
      await api.post('/messages', { receiverId, type: 'opportunity', opportunityId });
      handleClose();
      showToast('Opportunità condivisa', 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      if (msg) showToast(msg, 'error');
      else showToast("Errore nell'invio", 'error');
    } finally {
      setSending(false);
    }
  };

  if (!mounted) return null;

  const filteredFriends = friends.filter((f) =>
    `${f.name} ${f.surname}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      onClick={() => handleClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backgroundColor: 'rgba(44,49,73,0.45)',
        backdropFilter: phase === 'visible' ? 'blur(4px)' : 'blur(0px)',
        WebkitBackdropFilter: phase === 'visible' ? 'blur(4px)' : 'blur(0px)',
        opacity: phase === 'visible' ? 1 : 0,
        transition: 'opacity 0.28s ease, backdrop-filter 0.28s ease',
        fontFamily: 'var(--font-plus-jakarta)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          maxHeight: '85vh',
          backgroundColor: '#fbf8ff',
          borderRadius: '24px 24px 0 0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(44,49,73,0.14)',
          transform: phase === 'visible' ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
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
            <p style={{ fontWeight: 700, fontSize: 17, color: '#2c3149', margin: 0 }}>Condividi</p>
            <p style={{
              fontSize: 12, color: '#acb0ce', margin: '2px 0 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
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

        {/* External share button */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          <button
            onClick={handleExternalShare}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px', borderRadius: 16,
              border: '1px solid rgba(97,95,226,0.2)',
              backgroundColor: 'rgba(97,95,226,0.06)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              backgroundColor: 'rgba(97,95,226,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Share size={20} strokeWidth={1.8} color="#615fe2" />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, color: '#2c3149', margin: 0 }}>
                {canNativeShare ? 'Condividi su...' : 'Copia link'}
              </p>
              <p style={{ fontSize: 12, color: '#acb0ce', margin: '1px 0 0' }}>
                {canNativeShare ? 'WhatsApp, AirDrop, Messaggi e altro' : 'Copia il link negli appunti'}
              </p>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(172,176,206,0.2)' }} />
            <p style={{ fontSize: 12, color: '#acb0ce', margin: 0, flexShrink: 0 }}>Condividi con un amico</p>
            <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(172,176,206,0.2)' }} />
          </div>
        </div>

        {/* Search */}
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
              placeholder="Cerca un amico..."
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

        {/* Friends list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 24px' }}>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#e4e7ff', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, backgroundColor: '#e4e7ff', borderRadius: 6, width: '40%', marginBottom: 6 }} />
                  <div style={{ height: 11, backgroundColor: '#e4e7ff', borderRadius: 6, width: '60%' }} />
                </div>
              </div>
            ))
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#acb0ce' }}>
              <p style={{ fontSize: 14, margin: 0 }}>Non hai ancora amici su COhA</p>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#acb0ce' }}>
              <p style={{ fontSize: 14, margin: 0 }}>Nessun risultato per &ldquo;{search}&rdquo;</p>
            </div>
          ) : filteredFriends.map((f) => (
            <button
              key={f.id}
              onClick={() => handleShareWithFriend(f.id)}
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
                overflow: 'hidden', backgroundColor: f.avatarBgColor || 'rgba(97,95,226,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {f.avatar && isValidImageUrl(f.avatar) ? (
                  <img src={f.avatar} alt={`${f.name} ${f.surname}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#615fe2' }}>{f.name[0]}</span>
                )}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontWeight: 600, fontSize: 14, color: '#2c3149', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {f.name} {f.surname}
                </p>
              </div>

              {/* Send icon */}
              <div style={{ flexShrink: 0 }}>
                <PaperPlane size={20} strokeWidth={1.8} color="#615fe2" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
