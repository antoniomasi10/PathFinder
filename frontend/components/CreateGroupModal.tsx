'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

function compressImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasUnsavedChanges = name.trim() !== '' || description.trim() !== '' || selectedFriends.size > 0 || image !== null;

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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
    } catch {
      setError('Errore nel caricamento dell\'immagine');
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreate = selectedFriends.size >= 2;

  const generateAutoName = (): string => {
    const selectedNames = Array.from(selectedFriends)
      .map((id) => friends.find((f) => f.id === id)?.name)
      .filter(Boolean);
    if (selectedNames.length <= 3) {
      return `Gruppo con ${selectedNames.join(', ')}`;
    }
    return `Gruppo con ${selectedNames.slice(0, 2).join(', ')} e altri ${selectedNames.length - 2}`;
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError('');

    const groupName = name.trim() || generateAutoName();

    try {
      await api.post('/groups', {
        name: groupName,
        memberIds: Array.from(selectedFriends),
        description: description.trim() || undefined,
        image: image || undefined,
      });
      onGroupCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Impossibile creare il gruppo, riprova');
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
        {/* Group Photo + Name */}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {/* Image Picker */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full shrink-0 flex flex-col items-center justify-center relative overflow-hidden transition-colors"
              style={{
                border: '2px dashed #6C63FF',
                backgroundColor: image ? 'transparent' : 'rgba(108, 99, 255, 0.1)',
              }}
            >
              {image ? (
                <>
                  <img src={image} alt="Foto gruppo" className="w-full h-full object-cover" />
                  {/* Edit overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" style={{ color: '#6C63FF' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[10px] mt-0.5" style={{ color: '#6C63FF' }}>Aggiungi foto</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            <div className="flex-1 space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome del gruppo"
                className="input-field w-full"
                maxLength={50}
                style={{ backgroundColor: '#1C2333', borderRadius: '12px', padding: '12px' }}
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrizione (opzionale)"
                className="input-field w-full"
                maxLength={200}
                style={{ backgroundColor: '#1C2333', borderRadius: '12px', padding: '12px' }}
              />
            </div>
          </div>
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: 'rgba(108, 99, 255, 0.2)', color: '#6C63FF' }}
                >
                  {friend.name}
                  <button onClick={() => removeFriend(id)} className="hover:opacity-70">
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
                  <div
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: isSelected ? '#6C63FF' : 'transparent',
                      borderColor: isSelected ? '#6C63FF' : '#334155',
                    }}
                  >
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

      {/* Footer — Crea Gruppo button */}
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)] pt-4 border-t border-border">
        <button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          className="w-full flex items-center justify-center font-medium text-white transition-colors"
          style={{
            height: '56px',
            borderRadius: '12px',
            fontSize: '16px',
            backgroundColor: canCreate && !creating ? '#6C63FF' : '#4A4A6A',
            cursor: canCreate && !creating ? 'pointer' : 'not-allowed',
          }}
        >
          {creating ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            'Crea Gruppo'
          )}
        </button>
      </div>
    </div>
  );
}
