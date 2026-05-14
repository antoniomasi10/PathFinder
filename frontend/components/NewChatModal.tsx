'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { isValidImageUrl } from '@/lib/urlValidation';
import { Search } from '@/components/icons';

interface User {
  id: string;
  name: string;
  avatar?: string;
  courseOfStudy?: string;
  university?: { name: string };
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
      onUserSelected({ id: selected.id, name: selected.name, avatar: selected.avatar });
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', backgroundColor: '#fbf8ff', fontFamily: 'var(--font-plus-jakarta)' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        height: '4rem', display: 'flex', alignItems: 'center', padding: '0 1rem',
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(172,176,206,0.2)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => handleClose()}
          style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#595e78" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#2c3149' }}>{t.group.newChat}</span>
        </div>
        <div style={{ width: '2.5rem', flexShrink: 0 }} />
      </header>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1rem 10rem' }}>
        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Search size={16} color="#acb0ce" strokeWidth={2} />
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.group.searchUsers}
            autoFocus
            style={{
              width: '100%', height: '3rem', paddingLeft: '2.75rem', paddingRight: '1rem',
              backgroundColor: 'white', border: '1px solid rgba(172,176,206,0.4)',
              borderRadius: '1.5rem', fontSize: '0.875rem', color: '#2c3149',
              fontFamily: 'var(--font-plus-jakarta)', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Users list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.5rem', borderRadius: '1rem' }}>
                <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', backgroundColor: '#e4e7ff', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '0.875rem', backgroundColor: '#e4e7ff', borderRadius: '0.4375rem', width: '50%', marginBottom: '0.375rem' }} />
                  <div style={{ height: '0.6875rem', backgroundColor: '#e4e7ff', borderRadius: '0.375rem', width: '70%' }} />
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#acb0ce', fontSize: '0.875rem', padding: '2rem 0' }}>
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
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 0.5rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', textAlign: 'left',
                    backgroundColor: isSelected ? 'rgba(97,95,226,0.06)' : 'transparent',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: 'rgba(97,95,226,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {u.avatar && isValidImageUrl(u.avatar) ? (
                      <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#615fe2' }}>{u.name[0]}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#2c3149', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                    {u.university?.name && (
                      <p style={{ fontSize: '0.6875rem', color: '#747995', margin: '0.125rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.university.name}{u.courseOfStudy ? ` · ${u.courseOfStudy}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Radio */}
                  <div style={{
                    width: '1.375rem', height: '1.375rem', borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isSelected ? '#615fe2' : '#acb0ce'}`,
                    backgroundColor: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color 0.15s',
                  }}>
                    {isSelected && (
                      <div style={{ width: '0.6875rem', height: '0.6875rem', borderRadius: '50%', backgroundColor: '#615fe2' }} />
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
        padding: '0.75rem 1rem calc(env(safe-area-inset-bottom, 0rem) + 5rem)',
        backgroundColor: 'rgba(251,248,255,0.95)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        borderTop: '1px solid rgba(172,176,206,0.2)',
      }}>
        <button
          onClick={handleStart}
          disabled={!selectedUserId}
          style={{
            width: '100%', height: '3.25rem', borderRadius: '1.5rem', border: 'none', cursor: selectedUserId ? 'pointer' : 'not-allowed',
            backgroundColor: selectedUserId ? '#615fe2' : 'rgba(97,95,226,0.3)',
            color: 'white', fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: '1rem',
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
