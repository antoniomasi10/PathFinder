'use client';

import { useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: 'red' | 'indigo';
  requireInput?: string; // if set, user must type this to confirm
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Conferma',
  confirmColor = 'red',
  requireInput,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const canConfirm = requireInput ? inputValue === requireInput : true;

  const colorClass = confirmColor === 'red'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-indigo-600 hover:bg-indigo-700';

  const handleConfirm = () => {
    if (!canConfirm) return;
    setInputValue('');
    onConfirm();
  };

  const handleCancel = () => {
    setInputValue('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6" onClick={handleCancel}>
      <div
        className="bg-[#1a1b2e] border border-indigo-900/20 rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-medium text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-4">{message}</p>

        {requireInput && (
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Scrivi "${requireInput}" per confermare`}
            className="w-full bg-[#0D1117] border border-indigo-900/30 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-red-500 mb-4 transition-colors"
          />
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-400 bg-[#0D1117] hover:bg-[#161b22] transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 py-3 rounded-xl text-sm font-medium text-white transition-colors ${
              canConfirm ? colorClass : 'bg-gray-700 cursor-not-allowed'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
