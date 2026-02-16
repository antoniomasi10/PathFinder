'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingFlow from '@/components/onboarding';
import type { ProfileData } from '@/components/onboarding';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (user?.profileCompleted) {
    router.replace('/home');
    return null;
  }

  const handleComplete = async (profileData: ProfileData) => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      await api.post('/profile/questionnaire', profileData);
      if (user) setUser({ ...user, profileCompleted: true });
      router.push('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il salvataggio. Riprova.');
      setSaving(false);
    }
  };

  return (
    <>
      <OnboardingFlow onComplete={handleComplete} />
      {error && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-900/90 text-white px-4 py-3 rounded-xl text-sm text-center z-50">
          {error}
        </div>
      )}
    </>
  );
}
