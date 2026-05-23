'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { usePrivacy, type PrivacyOption } from '@/lib/privacy';
import api from '@/lib/api';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import {
  ChevronLeft, ChevronDown, Key, UserIcon, Award, Bookmark,
  UsersGroup, ChatDots, Bell, FileText, Trash, TriangleWarning,
} from '@/components/icons';

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-[#615fe2]' : 'bg-[rgba(172,176,206,0.4)]'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function PrivacyDropdown({ value, onChange, allowedOptions }: {
  value: PrivacyOption;
  onChange: (v: PrivacyOption) => void;
  allowedOptions?: PrivacyOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  const allOptions: { key: PrivacyOption; label: string }[] = [
    { key: 'Tutti', label: t.privacy.everyone },
    { key: 'Pathmates', label: 'Pathmates' },
    { key: 'Nessuno', label: t.privacy.nobody },
  ];
  const options = allowedOptions ? allOptions.filter(o => allowedOptions.includes(o.key)) : allOptions;
  const currentLabel = options.find(o => o.key === value)?.label ?? value;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-sm text-[#595e78] hover:text-[#2c3149] transition-colors">
        <span>{currentLabel}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[rgba(172,176,206,0.3)] rounded-xl overflow-hidden shadow-xl z-10 min-w-[120px]">
          {options.map(opt => (
            <button
              key={opt.key}
              onClick={() => { onChange(opt.key); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${opt.key === value ? 'text-[#615fe2] bg-[rgba(97,95,226,0.08)]' : 'text-[#595e78] hover:bg-[rgba(172,176,206,0.08)] hover:text-[#2c3149]'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const {
    publicProfile, togglePrivateProfile,
    privacySkills, setPrivacySkills,
    privacySavedOpps, setPrivacySavedOpps,
    privacyPathmates, setPrivacyPathmates,
    messagePrivacy, setMessagePrivacy,
  } = usePrivacy();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [emailSpot, setEmailSpot] = useState(true);

  useEffect(() => {
    api.get('/profile/me').then(({ data }) => {
      setMarketingConsent(data.marketingConsent ?? false);
    }).catch(() => {});
    api.get('/notifications/preferences').then(({ data }) => {
      setEmailSpot(data.emailSpot ?? true);
    }).catch(() => {});
  }, []);

  const handleExportData = async () => {
    try {
      const response = await api.get('/profile/me/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'coha-export.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete('/profile/me');
    } catch {
      setDeleting(false);
      return;
    }
    ['coha_privacy', 'coha_saved_opps', 'coha-saved-courses', 'openChatWith', 'pinnedConversations']
      .forEach(k => localStorage.removeItem(k));
    logout();
  };

  const iconWrap = 'w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0';
  const row = 'flex items-center justify-between py-2';
  const divider = 'ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]';

  return (
    <div className="min-h-screen bg-[#fbf8ff] pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(172,176,206,0.3)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#615fe2]" aria-label="Indietro">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[#2c3149] font-bold text-lg">{t.profile.securityPrivacy}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Sicurezza */}
        <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
          <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">{t.security.title}</h4>
          <button onClick={() => setShowChangePassword(true)} className={`w-full ${row}`}>
            <div className="flex items-center gap-3">
              <div className={iconWrap}><Key size={20} color="#615fe2" /></div>
              <span className="text-sm text-[#2c3149]">{t.security.changePassword}</span>
            </div>
            <ChevronDown size={16} color="#747995" className="-rotate-90" />
          </button>
        </div>

        {/* Visibilità profilo */}
        <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
          <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">{t.privacy.profileVisibility}</h4>
          <div className={row}>
            <div className="flex items-center gap-3">
              <div className={iconWrap}><UserIcon size={20} color="#615fe2" /></div>
              <span className="text-sm text-[#2c3149]">Profilo privato</span>
            </div>
            <Toggle value={!publicProfile} onChange={v => togglePrivateProfile(v)} />
          </div>
          <div className={divider} />
          <div className={row}>
            <div className="flex items-center gap-3">
              <div className={iconWrap}><Award size={20} color="#615fe2" /></div>
              <span className="text-sm text-[#2c3149]">{t.privacy.whoCanSeeSkills}</span>
            </div>
            <PrivacyDropdown value={privacySkills} onChange={setPrivacySkills} allowedOptions={!publicProfile ? ['Pathmates'] : ['Tutti', 'Pathmates']} />
          </div>
        </div>

        {/* Attività */}
        <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
          <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">{t.privacy.activity}</h4>
          <div className={row}>
            <div className="flex items-center gap-3">
              <div className={iconWrap}><Bookmark size={20} color="#615fe2" /></div>
              <span className="text-sm text-[#2c3149]">{t.privacy.whoCanSeeSavedOpps}</span>
            </div>
            <PrivacyDropdown value={privacySavedOpps} onChange={setPrivacySavedOpps} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
          </div>
          <div className={divider} />
          <div className={row}>
            <div className="flex items-center gap-3">
              <div className={iconWrap}><UsersGroup size={20} color="#615fe2" /></div>
              <span className="text-sm text-[#2c3149]">{t.privacy.whoCanSeePathmates}</span>
            </div>
            <PrivacyDropdown value={privacyPathmates} onChange={setPrivacyPathmates} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
          </div>
          <div className={divider} />
          <div className={row}>
            <div className="flex items-center gap-3">
              <div className={iconWrap}><ChatDots size={20} color="#615fe2" /></div>
              <span className="text-sm text-[#2c3149]">{t.privacy.whoCanMessage}</span>
            </div>
            <PrivacyDropdown value={messagePrivacy} onChange={setMessagePrivacy} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
          </div>
        </div>

        {/* Comunicazioni */}
        <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
          <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">Comunicazioni</h4>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <div className={iconWrap}><Bell size={20} color="#615fe2" /></div>
              <div>
                <span className="text-sm text-[#2c3149] font-medium">Email promozionali</span>
                <p className="text-xs text-[#747995]">Novità, opportunità selezionate e aggiornamenti</p>
              </div>
            </div>
            <Toggle
              value={marketingConsent}
              onChange={v => {
                setMarketingConsent(v);
                api.patch('/profile/me', { marketingConsent: v }).catch(() => setMarketingConsent(!v));
              }}
            />
          </div>
          {marketingConsent && (
            <>
              <div className={divider} />
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className={iconWrap}><Bell size={20} color="#615fe2" /></div>
                  <div>
                    <span className="text-sm text-[#2c3149] font-medium">Raccomandazioni spot</span>
                    <p className="text-xs text-[#747995]">Avvisi immediati per opportunità ad alto match (≥80%)</p>
                  </div>
                </div>
                <Toggle
                  value={emailSpot}
                  onChange={v => {
                    setEmailSpot(v);
                    api.put('/notifications/preferences', { emailSpot: v }).catch(() => setEmailSpot(!v));
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Account */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)]">
          <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider px-4 pt-4 pb-2">Account</h4>
          <button onClick={handleExportData} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[rgba(79,70,229,0.05)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[22%] bg-[rgba(79,70,229,0.08)] flex items-center justify-center flex-shrink-0">
                <FileText size={20} color="#615fe2" />
              </div>
              <span className="text-sm text-[#2c3149] font-medium">Scarica i tuoi dati (GDPR Art. 20)</span>
            </div>
            <ChevronDown size={16} color="#acb0ce" className="-rotate-90" />
          </button>
          <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.3)]" />
          <button onClick={() => setShowDeleteModal(true)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[rgba(239,68,68,0.05)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[22%] bg-[#EF4444]/10 flex items-center justify-center flex-shrink-0">
                <Trash size={20} color="#EF4444" />
              </div>
              <span className="text-sm text-[#EF4444] font-medium">{t.privacy.deleteAccount}</span>
            </div>
            <ChevronDown size={16} color="rgba(239,68,68,0.5)" className="-rotate-90" />
          </button>
        </div>

      </div>

      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />

      {showDeleteModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 border border-[rgba(172,176,206,0.3)]">
            <div className="w-14 h-14 rounded-full bg-[rgba(239,68,68,0.08)] flex items-center justify-center mx-auto">
              <TriangleWarning size={28} color="#EF4444" />
            </div>
            <div className="text-center">
              <h3 className="text-[#2c3149] font-bold text-lg mb-1">{t.privacy.deleteAccount}</h3>
              <p className="text-sm text-[#595e78]">{t.profile.deleteIrreversibleMsg}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-[#595e78] bg-[rgba(172,176,206,0.2)] transition-colors disabled:opacity-50"
              >
                {t.profile.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-[#EF4444] hover:bg-[#DC2626] transition-colors disabled:opacity-50"
              >
                {deleting ? t.profile.deletingAccount : t.privacy.deleteAccount}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
