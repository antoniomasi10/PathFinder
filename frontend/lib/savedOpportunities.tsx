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

const STORAGE_KEY = 'pathfinder_saved_opps';

function loadFromStorage(): SavedOpportunity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedOpportunity[];
  } catch {}
  return [];
}

function persistToStorage(opps: SavedOpportunity[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opps));
  } catch {}
}

const SavedOpportunitiesContext = createContext<SavedOpportunitiesContextType>({
  savedIds: new Set(),
  savedOpps: [],
  toggleSave: () => {},
});

export function SavedOpportunitiesProvider({ children }: { children: ReactNode }) {
  const [savedOpps, setSavedOpps] = useState<SavedOpportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const savedIdsRef = useRef<Set<string>>(savedIds);
  savedIdsRef.current = savedIds;

  useEffect(() => {
    const cached = loadFromStorage();

    if (cached.length > 0) {
      // localStorage has data — trust it completely, no API call needed
      setSavedOpps(cached);
      setSavedIds(new Set(cached.map((o) => o.id)));
      return;
    }

    // localStorage empty — hydrate from server once and seed localStorage
    api
      .get('/opportunities/saved')
      .then((res) => {
        const opps: SavedOpportunity[] = res.data;
        if (opps.length > 0) {
          setSavedOpps(opps);
          setSavedIds(new Set(opps.map((o) => o.id)));
          persistToStorage(opps);
        }
      })
      .catch(() => {});
  }, []);

  function toggleSave(
    oppId: string,
    data?: { title?: string; company?: string; type?: string },
  ) {
    const isSaved = savedIdsRef.current.has(oppId);

    if (isSaved) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(oppId);
        return next;
      });
      setSavedOpps((prev) => {
        const next = prev.filter((o) => o.id !== oppId);
        persistToStorage(next);
        return next;
      });
    } else {
      setSavedIds((prev) => new Set([...prev, oppId]));
      if (data?.title) {
        setSavedOpps((prev) => {
          const next = [
            ...prev,
            {
              id: oppId,
              title: data.title!,
              company: data.company,
              type: data.type ?? 'INTERNSHIP',
            },
          ];
          persistToStorage(next);
          return next;
        });
      }
    }

    // Persist to server (fire and forget)
    api.post(`/opportunities/${oppId}/save`).catch(() => {});
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
