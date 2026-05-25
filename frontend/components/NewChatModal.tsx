'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { isValidImageUrl } from '@/lib/urlValidation';
import { Search } from '@/components/icons';

interface User {
  id: string;
  name: string;
  surname?: string;
  avatar?: string;
  courseOfStudy?: string;
  university?: { name: string; shortName?: string };
}

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserSelected: (user: { id: string; name: string; avatar?: string }) => void;
}

export default function NewChatModal({ isOpen, onClose, onUserSelected }: NewChatModalProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback((fromPopState = false) => {
    if (!fromPopState) {
      window.history.back();
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ modal: 'newChat' }, '');
    const handlePopState = () => handleClose(true);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedUserId(null);
      setUsers([]);
      searchUsers('');
    }
  }, [isOpen]);

  const searchUsers = async (q: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, isOpen]);

  const handleStart = () => {
    if (!selectedUserId) return;
    const selected = users.find((u) => u.id === selectedUserId);
    if (selected) {
      window.history.back();
      onUserSelected({ id: selected.id, name: [selected.name, selected.surname].filter(Boolean).join(' '), avatar: selected.avatar });
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', backgroundColor: '#fbf8ff', fontFamily: 'var(--font-plus-jakarta)' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        height: 64, display: 'flex', alignItems: 'center', padding: '0 16px',
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(172,176,206,0.2)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => handleClose()}
          style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#595e78" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#2c3149' }}>{t.group.newChat}</span>
        </div>
        <div style={{ width: 40, flexShrink: 0 }} />
      </header>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 160px' }}>
        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Search size={16} color="#acb0ce" strokeWidth={2} />
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.group.searchUsers}
            autoFocus
            style={{
              width: '100%', height: 48, paddingLeft: 44, paddingRight: 16,
              backgroundColor: 'white', border: '1px solid rgba(172,176,206,0.4)',
              borderRadius: 24, fontSize: 14, color: '#2c3149',
              fontFamily: 'var(--font-plus-jakarta)', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Users list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderRadius: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#e4e7ff', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, backgroundColor: '#e4e7ff', borderRadius: 7, width: '50%', marginBottom: 6 }} />
                  <div style={{ height: 11, backgroundColor: '#e4e7ff', borderRadius: 6, width: '70%' }} />
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#acb0ce', fontSize: 14, padding: '32px 0' }}>
              {searchQuery ? t.group.noUsersFound : t.group.noUsersAvailable}
            </p>
          ) : (
            users.map((u) => {
              const isSelected = selectedUserId === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 8px', borderRadius: 16, border: 'none', cursor: 'pointer', textAlign: 'left',
                    backgroundColor: isSelected ? 'rgba(97,95,226,0.06)' : 'transparent',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: 'rgba(97,95,226,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {u.avatar && isValidImageUrl(u.avatar) ? (
                      <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#615fe2' }}>{u.name[0].toUpperCase()}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: '#2c3149', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[u.name, u.surname].filter(Boolean).join(' ')}</p>
                    {u.university?.name && (
                      <p style={{ fontSize: 11, color: '#747995', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.university.shortName || u.university.name}{u.courseOfStudy ? ` · ${u.courseOfStudy}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Radio */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isSelected ? '#615fe2' : '#acb0ce'}`,
                    backgroundColor: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color 0.15s',
                  }}>
                    {isSelected && (
                      <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#615fe2' }} />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 80px)',
        backgroundColor: 'rgba(251,248,255,0.95)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        borderTop: '1px solid rgba(172,176,206,0.2)',
      }}>
        <button
          onClick={handleStart}
          disabled={!selectedUserId}
          style={{
            width: '100%', height: 52, borderRadius: 24, border: 'none', cursor: selectedUserId ? 'pointer' : 'not-allowed',
            backgroundColor: selectedUserId ? '#615fe2' : 'rgba(97,95,226,0.3)',
            color: 'white', fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: 16,
            boxShadow: selectedUserId ? '0 2px 12px rgba(97,95,226,0.3)' : 'none',
            transition: 'background-color 0.2s, box-shadow 0.2s',
          }}
        >
          {t.group.startChat}
        </button>
      </div>
    </div>
  );
}
