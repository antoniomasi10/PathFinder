'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import api from '@/lib/api';

export interface SavedOpportunity {
  id: string;
  title: string;
  description?: string;
  about?: string;
  company?: string;
  type: string;
  url?: string;
  location?: string;
  isRemote?: boolean;
  deadline?: string;
  tags?: string[];
  university?: { name: string };
}

interface SavedOpportunitiesContextType {
  savedIds: Set<string>;
  savedOpps: SavedOpportunity[];
  toggleSave: (oppId: string, data?: Partial<SavedOpportunity>) => void;
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
    // Show cached data immediately, then sync from server
    const cached = loadFromStorage();
    if (cached.length > 0) {
      setSavedOpps(cached);
      setSavedIds(new Set(cached.map((o) => o.id)));
    }

    // Always fetch from server to stay in sync across devices
    api
      .get('/opportunities/saved')
      .then((res) => {
        const opps: SavedOpportunity[] = (res.data || []).map((o: any) => ({
          id: o.id,
          title: o.title,
          description: o.description,
          about: o.about,
          company: o.company,
          type: o.type,
          url: o.url,
          location: o.location,
          isRemote: o.isRemote,
          deadline: o.deadline,
          tags: o.tags,
          university: o.university,
        }));
        setSavedOpps(opps);
        setSavedIds(new Set(opps.map((o) => o.id)));
        persistToStorage(opps);
      })
      .catch((err) => {
        console.error('Failed to load saved opportunities:', err);
      });
  }, []);

  function toggleSave(
    oppId: string,
    data?: Partial<SavedOpportunity>,
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
              description: data.description,
              about: data.about,
              company: data.company,
              type: data.type ?? 'INTERNSHIP',
              url: data.url,
              location: data.location,
              isRemote: data.isRemote,
              deadline: data.deadline,
              tags: data.tags,
              university: data.university,
            },
          ];
          persistToStorage(next);
          return next;
        });
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
