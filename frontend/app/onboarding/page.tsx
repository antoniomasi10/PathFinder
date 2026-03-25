'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
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

  return (
    <AnimatePresence mode="wait">
      {revealData ? (
        <motion.div
          key="reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] as const, delay: 0.2 }}
          className="fixed inset-0 z-50"
        >
          <AvatarReveal
            avatarId={revealData.avatarId}
            profileData={revealData.profileData}
          />
        </motion.div>
      ) : (
        <motion.div
          key="flow"
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
          className="min-h-screen"
        >
          <OnboardingFlow onAvatarSelected={handleAvatarSelected} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
