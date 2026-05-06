'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { isValidImageUrl } from '@/lib/urlValidation';
import ConfirmDialog from './ConfirmDialog';
import { useLanguage } from '@/lib/language';
import { CloseLg } from '@/components/icons';

interface Member {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    courseOfStudy?: string;
    university?: { name: string };
  };
}

interface MemberListModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: Member[];
  currentUserId: string;
  isCreator: boolean;
  onMemberRemoved: () => void;
}

export default function MemberListModal({
  isOpen,
  onClose,
  groupId,
  members,
  currentUserId,
  isCreator,
  onMemberRemoved,
}: MemberListModalProps) {
  const { t } = useLanguage();
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

  if (!isOpen) return null;

  // Sort: CREATOR first, then alphabetical
  const sorted = [...members].sort((a, b) => {
    if (a.role === 'CREATOR') return -1;
    if (b.role === 'CREATOR') return 1;
    return a.user.name.localeCompare(b.user.name);
  });

  const handleRemove = async (member: Member) => {
    setRemoving(member.user.id);
    try {
      await api.delete(`/groups/${groupId}/members/${member.user.id}`);
      onMemberRemoved();
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setRemoving(null);
      setConfirmRemove(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0D1117' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-indigo-900/20">
        <h2 className="text-lg font-medium text-white">{t.group.viewMembers} ({members.length})</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <CloseLg size={24} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {sorted.map((member) => (
          <div
            key={member.user.id}
            className="flex items-center gap-3 p-3 rounded-xl"
          >
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0"
              style={{ boxShadow: '0 0 12px rgba(99, 102, 241, 0.2)' }}
            >
              {member.user.avatar && isValidImageUrl(member.user.avatar) ? (
                <img src={member.user.avatar} alt={member.user.name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <span className="text-white font-medium">{member.user.name[0]}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm truncate">{member.user.name}</span>
                {member.role === 'CREATOR' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium shrink-0">
                    {t.group.creator}
                  </span>
                )}
                {member.user.id === currentUserId && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 font-medium shrink-0">
                    {t.group.you}
                  </span>
                )}
              </div>
              {member.user.university?.name && (
                <p className="text-[11px] text-gray-500 truncate">
                  {member.user.university.name}
                  {member.user.courseOfStudy && ` · ${member.user.courseOfStudy}`}
                </p>
              )}
            </div>

            {/* Remove button — only for CREATOR, and not for self */}
            {isCreator && member.user.id !== currentUserId && (
              <button
                onClick={() => setConfirmRemove(member)}
                disabled={removing === member.user.id}
                className="text-red-400 hover:text-red-300 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
              >
                {removing === member.user.id ? '...' : t.group.remove}
              </button>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!confirmRemove}
        title={t.group.removeConfirmTitle}
        message={`${t.group.removeConfirmMsgPrefix} ${confirmRemove?.user.name} ${t.group.removeConfirmMsgSuffix}`}
        confirmLabel={t.group.removeConfirmBtn}
        confirmColor="red"
        onConfirm={() => confirmRemove && handleRemove(confirmRemove)}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
