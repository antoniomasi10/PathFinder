'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

export type PrivacyOption = 'Tutti' | 'Pathmates' | 'Nessuno';

export interface PrivacySettings {
  publicProfile: boolean;
  privacySkills: PrivacyOption;
  privacyUniversity: PrivacyOption;
  privacySavedOpps: PrivacyOption;
  privacyPathmates: PrivacyOption;
  messagePrivacy: PrivacyOption;
}

type SubSettings = Pick<PrivacySettings, 'privacySkills' | 'privacyUniversity' | 'privacySavedOpps' | 'privacyPathmates' | 'messagePrivacy'>;

interface PrivacyContextType extends PrivacySettings {
  setPublicProfile: (v: boolean) => void;
  setPrivacySkills: (v: PrivacyOption) => void;
  setPrivacyUniversity: (v: PrivacyOption) => void;
  setPrivacySavedOpps: (v: PrivacyOption) => void;
  setPrivacyPathmates: (v: PrivacyOption) => void;
  setMessagePrivacy: (v: PrivacyOption) => void;
  togglePrivateProfile: (isPrivate: boolean) => void;
}

const defaults: PrivacySettings = {
  publicProfile: true,
  privacySkills: 'Tutti',
  privacyUniversity: 'Tutti',
  privacySavedOpps: 'Pathmates',
  privacyPathmates: 'Pathmates',
  messagePrivacy: 'Pathmates',
};

const PrivacyContext = createContext<PrivacyContextType>({
  ...defaults,
  setPublicProfile: () => {},
  setPrivacySkills: () => {},
  setPrivacyUniversity: () => {},
  setPrivacySavedOpps: () => {},
  setPrivacyPathmates: () => {},
  setMessagePrivacy: () => {},
  togglePrivateProfile: () => {},
});

const STORAGE_KEY = 'pathfinder_privacy';

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PrivacySettings>(defaults);
  const [savedBeforePrivate, setSavedBeforePrivate] = useState<SubSettings | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...defaults, ...JSON.parse(stored) });
    } catch {}
    // Sync backend-stored privacy fields
    api.get('/profile/me').then((res) => {
      const { publicProfile, privacySavedOpps, privacyPathmates, messagePrivacy, privacySkills, privacyUniversity } = res.data ?? {};
      setSettings((prev) => {
        const next = {
          ...prev,
          ...(typeof publicProfile === 'boolean' ? { publicProfile } : {}),
          ...(privacySavedOpps ? { privacySavedOpps: privacySavedOpps as PrivacyOption } : {}),
          ...(privacyPathmates ? { privacyPathmates: privacyPathmates as PrivacyOption } : {}),
          ...(messagePrivacy ? { messagePrivacy: messagePrivacy as PrivacyOption } : {}),
          ...(privacySkills ? { privacySkills: privacySkills as PrivacyOption } : {}),
          ...(privacyUniversity ? { privacyUniversity: privacyUniversity as PrivacyOption } : {}),
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }).catch(() => {});
  }, []);

  function update<K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    // Persist backend-synced privacy fields
    if (key === 'publicProfile' || key === 'privacySavedOpps' || key === 'privacyPathmates' || key === 'messagePrivacy' || key === 'privacySkills' || key === 'privacyUniversity') {
      api.patch('/profile/me', { [key]: value }).catch(() => {});
    }
  }

  function togglePrivateProfile(isPrivate: boolean) {
    if (isPrivate) {
      setSavedBeforePrivate({
        privacySkills: settings.privacySkills,
        privacyUniversity: settings.privacyUniversity,
        privacySavedOpps: settings.privacySavedOpps,
        privacyPathmates: settings.privacyPathmates,
        messagePrivacy: settings.messagePrivacy,
      });
      setSettings((prev) => {
        const clamp = (v: PrivacyOption): PrivacyOption => v === 'Tutti' ? 'Pathmates' : v;
        const next: PrivacySettings = {
          ...prev,
          publicProfile: false,
          privacySkills: clamp(prev.privacySkills),
          privacyUniversity: clamp(prev.privacyUniversity),
          privacySavedOpps: clamp(prev.privacySavedOpps),
          privacyPathmates: clamp(prev.privacyPathmates),
          messagePrivacy: clamp(prev.messagePrivacy),
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
      const clampVal = (v: PrivacyOption) => v === 'Tutti' ? 'Pathmates' : v;
      api.patch('/profile/me', {
        publicProfile: false,
        privacySavedOpps: clampVal(settings.privacySavedOpps),
        privacyPathmates: clampVal(settings.privacyPathmates),
        privacySkills: clampVal(settings.privacySkills),
        privacyUniversity: clampVal(settings.privacyUniversity),
        messagePrivacy: clampVal(settings.messagePrivacy),
      }).catch(() => {});
    } else {
      setSettings((prev) => {
        const next: PrivacySettings = {
          ...prev,
          publicProfile: true,
          ...(savedBeforePrivate ?? {}),
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
      api.patch('/profile/me', {
        publicProfile: true,
        privacySavedOpps: savedBeforePrivate?.privacySavedOpps ?? 'Pathmates',
        privacyPathmates: savedBeforePrivate?.privacyPathmates ?? 'Pathmates',
        privacySkills: savedBeforePrivate?.privacySkills ?? 'Tutti',
        privacyUniversity: savedBeforePrivate?.privacyUniversity ?? 'Tutti',
        messagePrivacy: savedBeforePrivate?.messagePrivacy ?? 'Pathmates',
      }).catch(() => {});
      setSavedBeforePrivate(null);
    }
  }

  return (
    <PrivacyContext.Provider value={{
      ...settings,
      setPublicProfile: (v) => update('publicProfile', v),
      setPrivacySkills: (v) => update('privacySkills', v),
      setPrivacyUniversity: (v) => update('privacyUniversity', v),
      setPrivacySavedOpps: (v) => update('privacySavedOpps', v),
      setPrivacyPathmates: (v) => update('privacyPathmates', v),
      setMessagePrivacy: (v) => update('messagePrivacy', v),
      togglePrivateProfile,
    }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
