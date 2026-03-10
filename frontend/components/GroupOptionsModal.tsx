'use client';

import { useState, useRef } from 'react';
import api from '@/lib/api';
import { useToast } from './Toast';
import { useLanguage } from '@/lib/language';
import ConfirmDialog from './ConfirmDialog';
import AddMembersModal from './AddMembersModal';
import MemberListModal from './MemberListModal';

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

interface GroupDetails {
  id: string;
  name: string;
  image?: string;
  description?: string;
  createdAt: string;
  createdBy: { id: string; name: string; avatar?: string };
  members: {
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      avatar?: string;
      courseOfStudy?: string;
      university?: { name: string };
    };
  }[];
}

interface GroupOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupDetails;
  currentUserId: string;
  onGroupUpdated: () => void;
  onGroupLeft: () => void;
}

export default function GroupOptionsModal({
  isOpen,
  onClose,
  group,
  currentUserId,
  onGroupUpdated,
  onGroupLeft,
}: GroupOptionsModalProps) {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  if (!isOpen) return null;

  const isCreator = group.createdBy.id === currentUserId;
  const createdDate = new Date(group.createdAt).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUpdatingPhoto(true);
    try {
      const compressed = await compressImage(file);
      await api.put(`/groups/${group.id}/photo`, { image: compressed });
      showToast(t.group.photoUpdated, 'success');
      onGroupUpdated();
    } catch {
      showToast(t.group.errorUpdatePhoto, 'error');
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const handleLeave = async () => {
    try {
      await api.post(`/groups/${group.id}/leave`);
      showToast(t.group.leftGroup, 'info');
      setShowLeaveConfirm(false);
      onGroupLeft();
    } catch (err: any) {
      showToast(err.response?.data?.error || t.common.error, 'error');
      setShowLeaveConfirm(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/groups/${group.id}`);
      showToast(t.group.groupDeleted, 'info');
      setShowDeleteConfirm(false);
      onGroupLeft();
    } catch (err: any) {
      showToast(err.response?.data?.error || t.common.error, 'error');
      setShowDeleteConfirm(false);
    }
  };

  const handleMembersAdded = () => {
    setShowAddMembers(false);
    showToast(t.group.membersAdded, 'success');
    onGroupUpdated();
  };

  const handleMemberRemoved = () => {
    setShowMemberList(false);
    showToast(t.group.memberRemoved, 'success');
    onGroupUpdated();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0D1117' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-indigo-900/20">
          <h2 className="text-lg font-medium text-white">{t.group.options}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* Group info */}
          <div className="flex flex-col items-center text-center">
            <div
              className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-3 relative overflow-hidden"
              style={{ boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)' }}
            >
              {group.image ? (
                <img src={group.image} alt={group.name} className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <span className="text-white text-3xl font-medium">{group.name[0]}</span>
              )}
            </div>
            <h3 className="text-white font-medium text-xl">{group.name}</h3>
            <p className="text-gray-500 text-sm mt-1">{group.members.length} {t.group.memberCount}</p>
            <p className="text-gray-600 text-xs mt-1">
              {t.group.createdByPrefix} {group.createdBy.name} {t.group.onDate} {createdDate}
            </p>
            {group.description && (
              <p className="text-gray-400 text-sm mt-2">{group.description}</p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-1">
            {/* Change photo */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={updatingPhoto}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#1a1b2e] hover:bg-[#1e2035] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">
                {updatingPhoto ? t.group.updatingPhoto : t.group.editPhoto}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {/* Add members */}
            <button
              onClick={() => setShowAddMembers(true)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#1a1b2e] hover:bg-[#1e2035] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">{t.group.addMembers}</span>
            </button>

            {/* View members */}
            <button
              onClick={() => setShowMemberList(true)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#1a1b2e] hover:bg-[#1e2035] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">{t.group.viewMembers}</span>
            </button>
          </div>

          {/* Danger zone */}
          <div className="space-y-1 pt-2">
            <p className="text-gray-600 text-xs font-medium uppercase tracking-wider px-2 mb-2">{t.group.dangerZone}</p>

            {/* Leave group */}
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#1a1b2e] hover:bg-red-500/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <span className="text-red-400 text-sm font-medium">{t.group.leaveGroup}</span>
            </button>

            {/* Delete group — CREATOR only */}
            {isCreator && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#1a1b2e] hover:bg-red-500/10 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <span className="text-red-400 text-sm font-medium">{t.group.deleteGroup}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      <AddMembersModal
        isOpen={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        groupId={group.id}
        existingMemberIds={group.members.map((m) => m.user.id)}
        onMembersAdded={handleMembersAdded}
      />

      <MemberListModal
        isOpen={showMemberList}
        onClose={() => setShowMemberList(false)}
        groupId={group.id}
        members={group.members}
        currentUserId={currentUserId}
        isCreator={isCreator}
        onMemberRemoved={handleMemberRemoved}
      />

      <ConfirmDialog
        isOpen={showLeaveConfirm}
        title={t.group.leaveConfirmTitle}
        message={`${t.group.leaveConfirmMsgPrefix} "${group.name}"?`}
        confirmLabel={t.group.leaveConfirmBtn}
        confirmColor="red"
        onConfirm={handleLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t.group.deleteGroup}
        message={t.group.deleteConfirmMsg}
        confirmLabel={t.group.deleteConfirmBtn}
        confirmColor="red"
        requireInput={t.group.deleteConfirmInput}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
