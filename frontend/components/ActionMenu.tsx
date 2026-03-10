'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/lib/language';

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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
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
