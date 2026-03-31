'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import api from '@/lib/api';

export interface SavedCourse {
  id: string;
  name: string;
  university?: { name: string; city: string };
  type?: string;
}

interface SavedCoursesContextType {
  savedIds: Set<string>;
  savedCourses: SavedCourse[];
  toggleSave: (course: SavedCourse) => void;
}

const STORAGE_KEY = 'pathfinder_saved_courses';

function loadFromStorage(): SavedCourse[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedCourse[];
  } catch {}
  return [];
}

function persistToStorage(courses: SavedCourse[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch {}
}

const SavedCoursesContext = createContext<SavedCoursesContextType>({
  savedIds: new Set(),
  savedCourses: [],
  toggleSave: () => {},
});

export function SavedCoursesProvider({ children }: { children: ReactNode }) {
  // Lazy init: read localStorage synchronously so UI is correct on first render
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>(loadFromStorage);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(loadFromStorage().map((c) => c.id))
  );
  const savedIdsRef = useRef<Set<string>>(savedIds);
  savedIdsRef.current = savedIds;

  useEffect(() => {
    // Sync from DB — server is the source of truth for persistence across devices
    api
      .get('/courses/saved/list')
      .then((res) => {
        const courses: SavedCourse[] = (res.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          university: c.university,
          type: c.type,
        }));
        const serverIds = new Set(courses.map((c) => c.id));
        const localOnly = loadFromStorage().filter((c) => !serverIds.has(c.id));
        const merged = [...courses, ...localOnly];
        setSavedCourses(merged);
        setSavedIds(new Set(merged.map((c) => c.id)));
        persistToStorage(merged);
      })
      .catch(() => {
        // Server unreachable — keep localStorage data already loaded above
      });
  }, []);

  function toggleSave(course: SavedCourse) {
    const isSaved = savedIdsRef.current.has(course.id);

    // Optimistic update + immediate localStorage persist
    if (isSaved) {
      setSavedIds((prev) => { const next = new Set(prev); next.delete(course.id); return next; });
      setSavedCourses((prev) => { const next = prev.filter((c) => c.id !== course.id); persistToStorage(next); return next; });
    } else {
      setSavedIds((prev) => new Set([...prev, course.id]));
      setSavedCourses((prev) => { const next = [...prev, course]; persistToStorage(next); return next; });
    }

    // Persist to DB — if this fails, localStorage still has the correct state
    api.post(`/courses/${course.id}/save`).catch((err) => {
      console.error('Failed to sync course save with server:', err);
    });
  }

  return (
    <SavedCoursesContext.Provider value={{ savedIds, savedCourses, toggleSave }}>
      {children}
    </SavedCoursesContext.Provider>
  );
}

export function useSavedCourses() {
  return useContext(SavedCoursesContext);
}
