'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { isValidImageUrl } from '@/lib/urlValidation';
import { CloseLg, Search, Check, Spinner } from '@/components/icons';

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  courseOfStudy?: string;
  university?: { name: string };
}

interface AddMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  existingMemberIds: string[];
  onMembersAdded: () => void;
}

export default function AddMembersModal({
  isOpen,
  onClose,
  groupId,
  existingMemberIds,
  onMembersAdded,
}: AddMembersModalProps) {
  const { t } = useLanguage();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      setSelectedFriends(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch (err) {
      console.error('Failed to load friends:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const existingSet = new Set(existingMemberIds);

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableFriends = filteredFriends.filter((f) => !existingSet.has(f.id));
  const alreadyInGroup = filteredFriends.filter((f) => existingSet.has(f.id));

  const allInGroup = friends.length > 0 && friends.every((f) => existingSet.has(f.id));

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedFriends.size === 0) return;
    setAdding(true);
    try {
      for (const userId of selectedFriends) {
        await api.post(`/groups/${groupId}/members`, { userId });
      }
      onMembersAdded();
    } catch (err) {
      console.error('Failed to add members:', err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0D1117' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-indigo-900/20">
        <h2 className="text-lg font-medium text-white">{t.group.addMembers}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <CloseLg size={24} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.group.searchFriends}
            className="w-full bg-[#1a1b2e] border border-indigo-900/30 rounded-2xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-1" />
                <div className="h-3 bg-gray-700 rounded w-1/3" />
              </div>
            </div>
          ))
        ) : allInGroup ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">{t.group.allFriendsInGroup}</p>
          </div>
        ) : (
          <div className="space-y-1 pb-24">
            {/* Available friends */}
            {availableFriends.map((friend) => {
              const isSelected = selectedFriends.has(friend.id);
              return (
                <button
                  key={friend.id}
                  onClick={() => toggleFriend(friend.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1b2e] transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0">
                    {friend.avatar && isValidImageUrl(friend.avatar) ? (
                      <img src={friend.avatar} alt={friend.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      friend.name[0]
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-sm text-white">{friend.name}</p>
                    {friend.university?.name && (
                      <p className="text-[11px] text-gray-500 truncate">
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
                      <Check size={14} strokeWidth={3} className="text-white" />
                    )}
                  </div>
                </button>
              );
            })}

            {/* Already in group */}
            {alreadyInGroup.map((friend) => (
              <div
                key={friend.id}
                className="w-full flex items-center gap-3 p-3 rounded-xl opacity-50"
              >
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-gray-400 shrink-0">
                  {friend.avatar && isValidImageUrl(friend.avatar) ? (
                    <img src={friend.avatar} alt={friend.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    friend.name[0]
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-sm text-gray-400">{friend.name}</p>
                  <p className="text-[11px] text-gray-600">{t.group.alreadyInGroup}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-6 pt-4 border-t border-indigo-900/20">
        <button
          onClick={handleAdd}
          disabled={selectedFriends.size === 0 || adding}
          className="w-full flex items-center justify-center font-medium text-white transition-colors"
          style={{
            height: '56px',
            borderRadius: '12px',
            fontSize: '16px',
            backgroundColor: selectedFriends.size > 0 && !adding ? '#6C63FF' : '#4A4A6A',
            cursor: selectedFriends.size > 0 && !adding ? 'pointer' : 'not-allowed',
          }}
        >
          {adding ? (
            <Spinner size={20} className="text-white" />
          ) : (
            selectedFriends.size > 0 ? `${t.profile.add} (${selectedFriends.size})` : t.profile.add
          )}
        </button>
      </div>
    </div>
  );
}
