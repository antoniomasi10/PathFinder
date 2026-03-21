'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import api from '@/lib/api';

export interface SavedOpportunity {
  id: string;
  title: string;
  company?: string;
  type: string;
  university?: { name: string };
}

interface SavedOpportunitiesContextType {
  savedIds: Set<string>;
  savedOpps: SavedOpportunity[];
  toggleSave: (oppId: string, data?: { title?: string; company?: string; type?: string }) => void;
}

const SavedOpportunitiesContext = createContext<SavedOpportunitiesContextType>({
  savedIds: new Set(),
  savedOpps: [],
  toggleSave: () => {},
});

export function SavedOpportunitiesProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedOpps, setSavedOpps] = useState<SavedOpportunity[]>([]);
  const savedIdsRef = useRef<Set<string>>(savedIds);
  savedIdsRef.current = savedIds;

  useEffect(() => {
    api
      .get('/opportunities/saved')
      .then((res) => {
        const opps: SavedOpportunity[] = res.data;
        setSavedOpps(opps);
        setSavedIds(new Set(opps.map((o) => o.id)));
      })
      .catch((err) => {
        console.error('Failed to load saved opportunities:', err);
      });
  }, []);

  function toggleSave(
    oppId: string,
    data?: { title?: string; company?: string; type?: string },
  ) {
    const isSaved = savedIdsRef.current.has(oppId);

    // Save previous state for rollback
    const previousIds = new Set(savedIdsRef.current);
    const previousOpps = [...savedOpps];

    // Optimistic update
    if (isSaved) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(oppId);
        return next;
      });
      setSavedOpps((prev) => prev.filter((o) => o.id !== oppId));
    } else {
      setSavedIds((prev) => new Set([...prev, oppId]));
      if (data?.title) {
        setSavedOpps((prev) => [
          ...prev,
          {
            id: oppId,
            title: data.title!,
            company: data.company,
            type: data.type ?? 'INTERNSHIP',
          },
        ]);
      }
    }

    // Persist to server with rollback on error
    api.post(`/opportunities/${oppId}/save`).catch((err) => {
      console.error('Failed to save opportunity:', err);
      setSavedIds(previousIds);
      setSavedOpps(previousOpps);
    });
  }

  return (
    <SavedOpportunitiesContext.Provider value={{ savedIds, savedOpps, toggleSave }}>
      {children}
    </SavedOpportunitiesContext.Provider>
  );
}

export function useSavedOpportunities() {
  return useContext(SavedOpportunitiesContext);
}
