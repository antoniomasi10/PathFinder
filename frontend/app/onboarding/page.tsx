'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingFlow from '@/components/onboarding';
import AvatarReveal from '@/components/onboarding/AvatarReveal';
import type { ProfileData } from '@/components/onboarding';
import { useAuth } from '@/lib/auth';

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [revealData, setRevealData] = useState<{
    profileData: ProfileData;
    avatarId: string;
  } | null>(null);

  if (user?.profileCompleted) {
    router.replace('/home');
    return null;
  }

  const handleAvatarSelected = (profileData: ProfileData, avatarId: string) => {
    setRevealData({ profileData, avatarId });
  };

  // Show reveal animation
  if (revealData) {
    return (
      <AvatarReveal
        avatarId={revealData.avatarId}
        profileData={revealData.profileData}
      />
    );
  }

  // Show questionnaire + avatar selection flow
  return <OnboardingFlow onAvatarSelected={handleAvatarSelected} />;
}
