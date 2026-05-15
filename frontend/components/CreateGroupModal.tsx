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
  university?: { name: string; shortName?: string };
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
    width: '100%', height: 44, padding: '0 14px',
    backgroundColor: 'white', border: '1px solid rgba(172,176,206,0.4)',
    borderRadius: 16, fontSize: 14, color: '#2c3149',
    fontFamily: 'var(--font-plus-jakarta)', outline: 'none', boxSizing: 'border-box',
  };

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
          <span style={{ fontWeight: 700, fontSize: 17, color: '#2c3149' }}>{t.group.newGroup}</span>
        </div>
        <div style={{ width: 40, flexShrink: 0 }} />
      </header>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 160px' }}>

        {/* Group photo + name/description */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          {/* Image picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 76, height: 76, borderRadius: '50%', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed #615fe2', cursor: 'pointer', overflow: 'hidden', position: 'relative',
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
                <span style={{ fontSize: 9, color: '#615fe2', marginTop: 3, fontWeight: 500 }}>{t.networking.addPhoto}</span>
              </>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />

          {/* Name + description */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {Array.from(selectedFriends).map((id) => {
              const friend = friends.find((f) => f.id === id);
              if (!friend) return null;
              return (
                <span
                  key={id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 9999,
                    backgroundColor: 'rgba(97,95,226,0.12)', color: '#615fe2',
                    fontSize: 12, fontWeight: 500,
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
        <p style={{ fontSize: 13, fontWeight: 500, color: selectedFriends.size < 2 ? '#ef4444' : '#595e78', marginBottom: 12 }}>
          {t.group.selectedCount.replace('{count}', String(selectedFriends.size))}{selectedFriends.size < 2 ? ` ${t.group.minTwo}` : ''}
        </p>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Search size={16} color="#acb0ce" strokeWidth={2} />
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.group.searchFriends}
            style={{ ...inputStyle, paddingLeft: 44, height: 48, borderRadius: 24 }}
          />
        </div>

        {/* Friends list */}
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
          ) : filteredFriends.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#acb0ce', fontSize: 14, padding: '32px 0' }}>
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
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 8px', borderRadius: 16, border: 'none', cursor: 'pointer', textAlign: 'left',
                    backgroundColor: isSelected ? 'rgba(97,95,226,0.06)' : 'transparent',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: 'rgba(97,95,226,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {friend.avatar && isValidImageUrl(friend.avatar) ? (
                      <img src={friend.avatar} alt={friend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#615fe2' }}>{friend.name[0]}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: '#2c3149', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.name}</p>
                    {friend.university?.name && (
                      <p style={{ fontSize: 11, color: '#747995', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {friend.university.shortName || friend.university.name}{friend.courseOfStudy ? ` · ${friend.courseOfStudy}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Checkbox */}
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
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
        <div style={{ padding: '10px 16px', backgroundColor: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 80px)',
        backgroundColor: 'rgba(251,248,255,0.95)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        borderTop: '1px solid rgba(172,176,206,0.2)',
      }}>
        <button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          style={{
            width: '100%', height: 52, borderRadius: 24, border: 'none',
            cursor: canCreate && !creating ? 'pointer' : 'not-allowed',
            backgroundColor: canCreate && !creating ? '#615fe2' : 'rgba(97,95,226,0.3)',
            color: 'white', fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: 16,
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
