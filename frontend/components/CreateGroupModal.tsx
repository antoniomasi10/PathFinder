'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  courseOfStudy?: string;
  university?: { name: string };
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
}

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const hasUnsavedChanges = name.trim() !== '' || description.trim() !== '' || selectedFriends.size > 0;

  const handleClose = useCallback((fromPopState = false) => {
    const close = () => {
      if (!fromPopState) {
        window.history.back();
      }
      onClose();
    };

    if (hasUnsavedChanges) {
      if (window.confirm('Vuoi davvero uscire? Le modifiche non salvate andranno perse.')) {
        close();
      } else if (fromPopState) {
        window.history.pushState({ modal: 'createGroup' }, '');
      }
    } else {
      close();
    }
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ modal: 'createGroup' }, '');

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
      loadFriends();
      // Reset state
      setName('');
      setDescription('');
      setImage(null);
      setSelectedFriends(new Set());
      setSearchQuery('');
      setError('');
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch {
      setError('Errore nel caricamento degli amici');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const removeFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreate = name.trim() !== '' && selectedFriends.size >= 2;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError('');
    try {
      await api.post('/groups', {
        name: name.trim(),
        memberIds: Array.from(selectedFriends),
        description: description.trim() || undefined,
        image: image || undefined,
      });
      onGroupCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nella creazione del gruppo');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0D1117' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-lg font-display font-bold text-text-primary">Nuovo Gruppo</h2>
        <button onClick={() => handleClose()} className="text-text-muted hover:text-text-primary transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Group Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center cursor-pointer shrink-0 hover:bg-primary/30 transition-colors">
              {image ? (
                <span className="text-2xl font-bold text-primary">{name[0]?.toUpperCase() || 'G'}</span>
              ) : (
                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </label>
            <div className="flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome del gruppo *"
                className="input-field w-full"
                maxLength={50}
              />
            </div>
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrizione (opzionale)"
            className="input-field w-full"
            maxLength={200}
          />
        </div>

        {/* Selected Friends Chips */}
        {selectedFriends.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedFriends).map((id) => {
              const friend = friends.find((f) => f.id === id);
              if (!friend) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 bg-primary/20 text-primary text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  {friend.name}
                  <button onClick={() => removeFriend(id)} className="hover:text-primary/70">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Counter */}
        <div className="flex items-center justify-between">
          <p className={`text-sm font-medium ${selectedFriends.size < 2 ? 'text-error' : 'text-text-secondary'}`}>
            {selectedFriends.size} selezionati {selectedFriends.size < 2 && '(minimo 2)'}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca amici..."
            className="input-field w-full pl-10"
          />
        </div>

        {/* Friends List */}
        <div className="space-y-1">
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
          ) : filteredFriends.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-6">
              {friends.length === 0 ? 'Nessun amico trovato' : 'Nessun risultato'}
            </p>
          ) : (
            filteredFriends.map((friend) => {
              const isSelected = selectedFriends.has(friend.id);
              return (
                <button
                  key={friend.id}
                  onClick={() => toggleFriend(friend.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-card transition-colors"
                >
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {friend.name[0]}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-sm text-text-primary">{friend.name}</p>
                    {friend.university?.name && (
                      <p className="text-[11px] text-text-muted truncate">
                        {friend.university.name} {friend.courseOfStudy && `· ${friend.courseOfStudy}`}
                      </p>
                    )}
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-primary border-primary' : 'border-border'
                  }`}>
                    {isSelected && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-error/10 text-error text-sm text-center">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          className="btn-primary w-full disabled:opacity-50"
        >
          {creating ? 'Creazione...' : 'Crea Gruppo'}
        </button>
      </div>
    </div>
  );
}
