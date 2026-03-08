'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { BadgeDefinition, trackAction, setTrackingValue } from '@/lib/badges';
import BadgeToast from './BadgeToast';

interface BadgeContextType {
  track: (trackingKey: string, increment?: number) => void;
  setAbsolute: (trackingKey: string, value: number) => void;
}

const BadgeContext = createContext<BadgeContextType>({
  track: () => {},
  setAbsolute: () => {},
});

export function useBadges() {
  return useContext(BadgeContext);
}

export default function BadgeProvider({ children }: { children: ReactNode }) {
  const [toastQueue, setToastQueue] = useState<BadgeDefinition[]>([]);

  const showNewBadges = useCallback((newlyUnlocked: BadgeDefinition[]) => {
    if (newlyUnlocked.length > 0) {
      setToastQueue((prev) => [...prev, ...newlyUnlocked]);
    }
  }, []);

  const track = useCallback((trackingKey: string, increment = 1) => {
    const unlocked = trackAction(trackingKey, increment);
    showNewBadges(unlocked);
  }, [showNewBadges]);

  const setAbsolute = useCallback((trackingKey: string, value: number) => {
    const unlocked = setTrackingValue(trackingKey, value);
    showNewBadges(unlocked);
  }, [showNewBadges]);

  const dismissFirst = useCallback(() => {
    setToastQueue((prev) => prev.slice(1));
  }, []);

  return (
    <BadgeContext.Provider value={{ track, setAbsolute }}>
      {children}
      {toastQueue.length > 0 && (
        <BadgeToast badge={toastQueue[0]} onDismiss={dismissFirst} />
      )}
    </BadgeContext.Provider>
  );
}
