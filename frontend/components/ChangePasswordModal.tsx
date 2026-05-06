'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { Eye, EyeOff, CloseMd, Check } from '@/components/icons';

type Screen = 'change' | 'forgot-email' | 'forgot-code' | 'success';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <Eye size={20} strokeWidth={2} />
  ) : (
    <EyeOff size={20} strokeWidth={2} />
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.4)] rounded-xl px-4 py-3 pr-11 text-[#2c3149] text-sm placeholder:text-[#b0b4cb] focus:outline-none focus:border-[#615fe2] transition-colors"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747995] hover:text-[#615fe2] transition-colors"
      >
        <EyeIcon visible={show} />
      </button>
    </div>
  );
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { t } = useLanguage();

  const [screen, setScreen] = useState<Screen>('change');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Change password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Forgot password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  const reset = () => {
    setScreen('change');
    setLoading(false);
    setError('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setResetEmail('');
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Cambia password ──────────────────────────────────────────────
  const handleChangePassword = async () => {
    setError('');
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setError(t.security.passwordTooShort); return;
    }
    if (newPassword !== confirmPassword) { setError(t.security.passwordMismatch); return; }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { oldPassword, newPassword });
      setScreen('success');
    } catch (err: any) {
      setError(err.response?.data?.error || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  // ── Invia codice reset ───────────────────────────────────────────
  const handleSendCode = async () => {
    setError('');
    if (!resetEmail.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: resetEmail.trim() });
      setScreen('forgot-code');
    } catch (err: any) {
      setError(err.response?.data?.error || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  // ── Reimposta password con codice ────────────────────────────────
  const handleResetPassword = async () => {
    setError('');
    if (resetNewPassword.length < 8 || !/[A-Z]/.test(resetNewPassword) || !/[a-z]/.test(resetNewPassword) || !/[0-9]/.test(resetNewPassword) || !/[^A-Za-z0-9]/.test(resetNewPassword)) {
      setError(t.security.passwordTooShort); return;
    }
    if (resetNewPassword !== resetConfirmPassword) { setError(t.security.passwordMismatch); return; }
    if (!resetCode.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: resetEmail.trim(),
        code: resetCode.trim(),
        newPassword: resetNewPassword,
      });
      setScreen('success');
    } catch (err: any) {
      setError(err.response?.data?.error || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/70"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-end justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg bg-white rounded-t-3xl animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.3)]">
            <h2 className="text-[#2c3149] font-bold text-lg">
              {screen === 'forgot-email' || screen === 'forgot-code'
                ? t.security.forgotPasswordTitle
                : t.security.changePasswordTitle}
            </h2>
            <button
              onClick={handleClose}
              className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors"
            >
              <CloseMd size={20} strokeWidth={2} className="text-[#595e78]" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">

            {/* ── SUCCESS ── */}
            {screen === 'success' && (
              <div className="flex flex-col items-center text-center py-6 gap-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check size={32} strokeWidth={2} className="text-green-500" />
                </div>
                <p className="text-[#2c3149] font-semibold text-base">{t.security.passwordUpdated}</p>
                <button
                  onClick={handleClose}
                  className="w-full py-3 rounded-xl text-sm font-medium text-white bg-[#615fe2] hover:bg-[#4f4dc0] transition-colors"
                >
                  {t.profile.done}
                </button>
              </div>
            )}

            {/* ── CHANGE PASSWORD ── */}
            {screen === 'change' && (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#747995] mb-1.5">{t.security.currentPassword}</label>
                    <PasswordInput
                      value={oldPassword}
                      onChange={setOldPassword}
                      placeholder={t.security.passwordPlaceholder}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#747995] mb-1.5">{t.security.newPassword}</label>
                    <PasswordInput
                      value={newPassword}
                      onChange={setNewPassword}
                      placeholder={t.security.newPasswordPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#747995] mb-1.5">{t.security.confirmPassword}</label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t.security.confirmPasswordPlaceholder}
                    />
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  onClick={handleChangePassword}
                  disabled={loading || !oldPassword || !newPassword || !confirmPassword}
                  className="w-full py-3 rounded-xl text-sm font-medium text-white bg-[#615fe2] hover:bg-[#4f4dc0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t.security.updatePassword}
                </button>

                <button
                  onClick={() => { setError(''); setScreen('forgot-email'); }}
                  className="w-full text-center text-sm text-[#615fe2] hover:text-[#7073ff] transition-colors py-1"
                >
                  {t.security.forgotPassword}
                </button>
              </>
            )}

            {/* ── FORGOT — inserisci email ── */}
            {screen === 'forgot-email' && (
              <>
                <p className="text-sm text-[#595e78]">{t.security.forgotPasswordDesc}</p>

                <div>
                  <label className="block text-xs font-medium text-[#747995] mb-1.5">{t.security.emailLabel}</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={t.security.emailPlaceholder}
                    autoFocus
                    className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.4)] rounded-xl px-4 py-3 text-[#2c3149] text-sm placeholder:text-[#b0b4cb] focus:outline-none focus:border-[#615fe2] transition-colors"
                  />
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  onClick={handleSendCode}
                  disabled={loading || !resetEmail.trim()}
                  className="w-full py-3 rounded-xl text-sm font-medium text-white bg-[#615fe2] hover:bg-[#4f4dc0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t.security.sendCode}
                </button>

                <button
                  onClick={() => { setError(''); setScreen('change'); }}
                  className="w-full text-center text-sm text-[#747995] hover:text-[#595e78] transition-colors py-1"
                >
                  {t.security.backToLogin}
                </button>
              </>
            )}

            {/* ── FORGOT — inserisci codice + nuova password ── */}
            {screen === 'forgot-code' && (
              <>
                <p className="text-sm text-[#595e78]">
                  {t.security.codeSentDesc.replace('{email}', resetEmail)}
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#747995] mb-1.5">{t.security.verificationCode}</label>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t.security.codePlaceholder}
                      autoFocus
                      maxLength={6}
                      className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.4)] rounded-xl px-4 py-3 text-[#2c3149] text-sm text-center tracking-[0.5em] font-mono placeholder:text-[#b0b4cb] placeholder:tracking-normal focus:outline-none focus:border-[#615fe2] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#747995] mb-1.5">{t.security.newPassword}</label>
                    <PasswordInput
                      value={resetNewPassword}
                      onChange={setResetNewPassword}
                      placeholder={t.security.newPasswordPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#747995] mb-1.5">{t.security.confirmPassword}</label>
                    <PasswordInput
                      value={resetConfirmPassword}
                      onChange={setResetConfirmPassword}
                      placeholder={t.security.confirmPasswordPlaceholder}
                    />
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  onClick={handleResetPassword}
                  disabled={loading || !resetCode || !resetNewPassword || !resetConfirmPassword}
                  className="w-full py-3 rounded-xl text-sm font-medium text-white bg-[#615fe2] hover:bg-[#4f4dc0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t.security.resetPassword}
                </button>

                <button
                  onClick={async () => {
                    setError('');
                    setLoading(true);
                    try {
                      await api.post('/auth/forgot-password', { email: resetEmail.trim() });
                      setError('');
                      setTimeout(() => {}, 0);
                    } catch {
                      setError(t.common.error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full text-center text-sm text-[#747995] hover:text-[#595e78] transition-colors py-1"
                >
                  {t.security.resendCode}
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
