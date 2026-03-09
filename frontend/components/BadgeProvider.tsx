'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { BadgeDefinition, trackAction, setTrackingValue } from '@/lib/badges';
import BadgeUnlockModal from './BadgeToast';

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
  const [queue, setQueue] = useState<BadgeDefinition[]>([]);

  const enqueue = useCallback((newlyUnlocked: BadgeDefinition[]) => {
    if (newlyUnlocked.length > 0) {
      setQueue((prev) => [...prev, ...newlyUnlocked]);
    }
  }, []);

  const track = useCallback((trackingKey: string, increment = 1) => {
    const unlocked = trackAction(trackingKey, increment);
    enqueue(unlocked);
  }, [enqueue]);

  const setAbsolute = useCallback((trackingKey: string, value: number) => {
    const unlocked = setTrackingValue(trackingKey, value);
    enqueue(unlocked);
  }, [enqueue]);

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  return (
    <BadgeContext.Provider value={{ track, setAbsolute }}>
      {children}
      {queue.length > 0 && (
        <BadgeUnlockModal badge={queue[0]} onDismiss={dismissCurrent} />
      )}
    </BadgeContext.Provider>
  );
}
