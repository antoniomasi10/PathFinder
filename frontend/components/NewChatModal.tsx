'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

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

    const handlePopState = () => {
      handleClose(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
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
    debounceRef.current = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, isOpen]);

  const handleStart = () => {
    if (!selectedUserId) return;
    const selected = users.find((u) => u.id === selectedUserId);
    if (selected) {
      // Pop the modal history entry
      window.history.back();
      onUserSelected({ id: selected.id, name: selected.name, avatar: selected.avatar });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0D1117' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-lg font-display font-bold text-text-primary">Nuova chat</h2>
        <button onClick={() => handleClose()} className="text-text-muted hover:text-text-primary transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca utenti..."
            className="input-field w-full pl-10"
            autoFocus
          />
        </div>

        {/* Users List */}
        <div className="space-y-1 pb-24">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-10 h-10 bg-border rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-border rounded w-1/2 mb-1" />
                  <div className="h-3 bg-border rounded w-1/3" />
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-6">
              {searchQuery ? 'Nessun utente trovato' : 'Nessun utente disponibile'}
            </p>
          ) : (
            users.map((u) => {
              const isSelected = selectedUserId === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-card transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-primary shrink-0 overflow-hidden">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      u.name[0]
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-sm text-text-primary">{u.name}</p>
                    {u.university?.name && (
                      <p className="text-[11px] text-text-muted truncate">
                        {u.university.name} {u.courseOfStudy && `· ${u.courseOfStudy}`}
                      </p>
                    )}
                  </div>

                  {/* Radio button */}
                  <div
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      borderColor: isSelected ? '#6C63FF' : '#334155',
                      backgroundColor: 'transparent',
                    }}
                  >
                    {isSelected && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: '#6C63FF' }}
                      />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer — Avvia chat button */}
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)] pt-4 border-t border-border">
        <button
          onClick={handleStart}
          disabled={!selectedUserId}
          className="w-full flex items-center justify-center font-medium text-white transition-colors"
          style={{
            height: '56px',
            borderRadius: '12px',
            fontSize: '16px',
            backgroundColor: selectedUserId ? '#6C63FF' : '#4A4A6A',
            cursor: selectedUserId ? 'pointer' : 'not-allowed',
          }}
        >
          Avvia chat
        </button>
      </div>
    </div>
  );
}
