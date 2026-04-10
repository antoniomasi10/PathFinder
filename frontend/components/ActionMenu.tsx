'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/lib/language';
import { ChatDots, UsersGroup } from '@/components/icons';

interface ActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onCreateGroup: () => void;
}

export default function ActionMenu({ isOpen, onClose, onNewChat, onCreateGroup }: ActionMenuProps) {
  const { t } = useLanguage();
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative animate-slide-up"
        style={{
          backgroundColor: '#1C2333',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {/* Nuova chat */}
          <button
            onClick={() => { onClose(); onNewChat(); }}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-indigo-400"
              style={{ backgroundColor: 'rgba(99,102,241,0.2)' }}
            >
              <ChatDots size={24} />
            </div>
            <div className="text-left">
              <p className="text-white font-medium text-[15px]">{t.group.newChat}</p>
              <p className="text-gray-400 text-xs">{t.group.newChatDesc}</p>
            </div>
          </button>

          {/* Separator */}
          <div className="border-t border-gray-700/50 mx-4" />

          {/* Crea gruppo */}
          <button
            onClick={() => { onClose(); onCreateGroup(); }}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-purple-400"
              style={{ backgroundColor: 'rgba(139,92,246,0.2)' }}
            >
              <UsersGroup size={24} />
            </div>
            <div className="text-left">
              <p className="text-white font-medium text-[15px]">{t.networking.createGroup}</p>
              <p className="text-gray-400 text-xs">{t.group.createGroupDesc}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
