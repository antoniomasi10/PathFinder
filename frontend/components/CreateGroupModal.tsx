'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { CloseSm, Pencil, Plus, Search, Check, Spinner } from '@/components/icons';
import { isValidImageUrl } from '@/lib/urlValidation';

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
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
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
  const { t } = useLanguage();
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
      if (!fromPopState) window.history.back();
      onClose();
    };
    if (hasUnsavedChanges) {
      if (window.confirm(t.group.unsavedChanges)) {
        close();
      } else if (fromPopState) {
        window.history.pushState({ modal: 'createGroup' }, '');
      }
    } else {
      close();
    }
  }, [hasUnsavedChanges, onClose, t]);

  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ modal: 'createGroup' }, '');
    const handlePopState = () => handleClose(true);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      setName(''); setDescription(''); setImage(null);
      setSelectedFriends(new Set()); setSearchQuery(''); setError('');
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch {
      setError(t.group.errorLoadFriends);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const removeFriend = (id: string) => {
    setSelectedFriends((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImage(await compressImage(file));
    } catch {
      setError(t.group.errorLoadImage);
    }
    e.target.value = '';
  };

  const filteredFriends = friends.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const canCreate = selectedFriends.size >= 2;

  const generateAutoName = (): string => {
    const selectedNames = Array.from(selectedFriends).map((id) => friends.find((f) => f.id === id)?.name).filter(Boolean);
    if (selectedNames.length <= 3) return `${t.group.autoNameWith} ${selectedNames.join(', ')}`;
    return `${t.group.autoNameWith} ${selectedNames.slice(0, 2).join(', ')} ${t.group.autoNameOthers} ${selectedNames.length - 2}`;
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true); setError('');
    const groupName = name.trim() || generateAutoName();
    try {
      await api.post('/groups', { name: groupName, memberIds: Array.from(selectedFriends), description: description.trim() || undefined, image: image || undefined });
      onGroupCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t.group.errorCreate);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '2.75rem', padding: '0 0.875rem',
    backgroundColor: 'white', border: '1px solid rgba(172,176,206,0.4)',
    borderRadius: '1rem', fontSize: '0.875rem', color: '#2c3149',
    fontFamily: 'var(--font-plus-jakarta)', outline: 'none', boxSizing: 'border-box',
  };

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
          <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#2c3149' }}>{t.group.newGroup}</span>
        </div>
        <div style={{ width: '2.5rem', flexShrink: 0 }} />
      </header>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1rem 10rem' }}>

        {/* Group photo + name/description */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Image picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '4.75rem', height: '4.75rem', borderRadius: '50%', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '0.125rem dashed #615fe2', cursor: 'pointer', overflow: 'hidden', position: 'relative',
              backgroundColor: image ? 'transparent' : 'rgba(97,95,226,0.08)',
            }}
          >
            {image ? (
              <>
                <img src={image} alt="Foto gruppo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(44,49,73,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }}
                  className="hover:opacity-100 transition-opacity">
                  <Pencil size={20} color="white" />
                </div>
              </>
            ) : (
              <>
                <Plus size={22} strokeWidth={2} color="#615fe2" />
                <span style={{ fontSize: '0.5625rem', color: '#615fe2', marginTop: '0.1875rem', fontWeight: 500 }}>{t.networking.addPhoto}</span>
              </>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />

          {/* Name + description */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.group.groupName}
              maxLength={50}
              style={inputStyle}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.group.description}
              maxLength={200}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Selected friends chips */}
        {selectedFriends.size > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {Array.from(selectedFriends).map((id) => {
              const friend = friends.find((f) => f.id === id);
              if (!friend) return null;
              return (
                <span
                  key={id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.3125rem 0.75rem', borderRadius: '624.9375rem',
                    backgroundColor: 'rgba(97,95,226,0.12)', color: '#615fe2',
                    fontSize: '0.75rem', fontWeight: 500,
                  }}
                >
                  {friend.name}
                  <button onClick={() => removeFriend(id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#615fe2' }}>
                    <CloseSm size={14} strokeWidth={2.5} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Counter */}
        <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: selectedFriends.size < 2 ? '#ef4444' : '#595e78', marginBottom: '0.75rem' }}>
          {t.group.selectedCount.replace('{count}', String(selectedFriends.size))}{selectedFriends.size < 2 ? ` ${t.group.minTwo}` : ''}
        </p>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Search size={16} color="#acb0ce" strokeWidth={2} />
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.group.searchFriends}
            style={{ ...inputStyle, paddingLeft: '2.75rem', height: '3rem', borderRadius: '1.5rem' }}
          />
        </div>

        {/* Friends list */}
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
          ) : filteredFriends.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#acb0ce', fontSize: '0.875rem', padding: '2rem 0' }}>
              {friends.length === 0 ? t.group.noFriendsFound : t.profile.noResults}
            </p>
          ) : (
            filteredFriends.map((friend) => {
              const isSelected = selectedFriends.has(friend.id);
              return (
                <button
                  key={friend.id}
                  onClick={() => toggleFriend(friend.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 0.5rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', textAlign: 'left',
                    backgroundColor: isSelected ? 'rgba(97,95,226,0.06)' : 'transparent',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: 'rgba(97,95,226,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {friend.avatar && isValidImageUrl(friend.avatar) ? (
                      <img src={friend.avatar} alt={friend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#615fe2' }}>{friend.name[0]}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#2c3149', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.name}</p>
                    {friend.university?.name && (
                      <p style={{ fontSize: '0.6875rem', color: '#747995', margin: '0.125rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {friend.university.name}{friend.courseOfStudy ? ` · ${friend.courseOfStudy}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Checkbox */}
                  <div style={{
                    width: '1.375rem', height: '1.375rem', borderRadius: '0.375rem', flexShrink: 0,
                    border: `2px solid ${isSelected ? '#615fe2' : '#acb0ce'}`,
                    backgroundColor: isSelected ? '#615fe2' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.15s, border-color 0.15s',
                  }}>
                    {isSelected && <Check size={13} strokeWidth={3} color="white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '0.625rem 1rem', backgroundColor: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: '0.8125rem', color: '#ef4444', textAlign: 'center', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '0.75rem 1rem calc(env(safe-area-inset-bottom, 0rem) + 5rem)',
        backgroundColor: 'rgba(251,248,255,0.95)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        borderTop: '1px solid rgba(172,176,206,0.2)',
      }}>
        <button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          style={{
            width: '100%', height: '3.25rem', borderRadius: '1.5rem', border: 'none',
            cursor: canCreate && !creating ? 'pointer' : 'not-allowed',
            backgroundColor: canCreate && !creating ? '#615fe2' : 'rgba(97,95,226,0.3)',
            color: 'white', fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: '1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: canCreate && !creating ? '0 2px 12px rgba(97,95,226,0.3)' : 'none',
            transition: 'background-color 0.2s, box-shadow 0.2s',
          }}
        >
          {creating ? <Spinner size={20} color="white" /> : t.networking.createGroup}
        </button>
      </div>
    </div>
  );
}
