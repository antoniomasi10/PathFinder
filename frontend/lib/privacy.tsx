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

interface PrivacyContextType extends PrivacySettings {
  setPublicProfile: (v: boolean) => void;
  setPrivacySkills: (v: PrivacyOption) => void;
  setPrivacyUniversity: (v: PrivacyOption) => void;
  setPrivacySavedOpps: (v: PrivacyOption) => void;
  setPrivacyPathmates: (v: PrivacyOption) => void;
  setMessagePrivacy: (v: PrivacyOption) => void;
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
});

const STORAGE_KEY = 'pathfinder_privacy';

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PrivacySettings>(defaults);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...defaults, ...JSON.parse(stored) });
    } catch {}
    // Sync backend-stored privacy fields
    api.get('/profile/me').then((res) => {
      const { publicProfile, privacySavedOpps, messagePrivacy } = res.data ?? {};
      setSettings((prev) => {
        const next = {
          ...prev,
          ...(typeof publicProfile === 'boolean' ? { publicProfile } : {}),
          ...(privacySavedOpps ? { privacySavedOpps: privacySavedOpps as PrivacyOption } : {}),
          ...(messagePrivacy ? { messagePrivacy: messagePrivacy as PrivacyOption } : {}),
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
    if (key === 'publicProfile' || key === 'privacySavedOpps' || key === 'messagePrivacy') {
      api.patch('/profile/me', { [key]: value }).catch(() => {});
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
    }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
