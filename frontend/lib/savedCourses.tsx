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
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const savedIdsRef = useRef<Set<string>>(savedIds);
  savedIdsRef.current = savedIds;

  useEffect(() => {
    // Show cached data immediately, then sync from server
    const cached = loadFromStorage();
    if (cached.length > 0) {
      setSavedCourses(cached);
      setSavedIds(new Set(cached.map((c) => c.id)));
    }

    // Always fetch from server to stay in sync
    api
      .get('/courses/saved/list')
      .then((res) => {
        const courses: SavedCourse[] = (res.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          university: c.university,
          type: c.type,
        }));
        setSavedCourses(courses);
        setSavedIds(new Set(courses.map((c) => c.id)));
        persistToStorage(courses);
      })
      .catch((err) => {
        console.error('Failed to load saved courses:', err.response?.status, err.response?.data || err.message);
      });
  }, []);

  function toggleSave(course: SavedCourse) {
    const isSaved = savedIdsRef.current.has(course.id);

    // Optimistic update + localStorage persist
    if (isSaved) {
      setSavedIds((prev) => { const next = new Set(prev); next.delete(course.id); return next; });
      setSavedCourses((prev) => { const next = prev.filter((c) => c.id !== course.id); persistToStorage(next); return next; });
    } else {
      setSavedIds((prev) => new Set([...prev, course.id]));
      setSavedCourses((prev) => { const next = [...prev, course]; persistToStorage(next); return next; });
    }

    // Background server sync — localStorage is the source of truth, no rollback on failure
    api.post(`/courses/${course.id}/save`).catch((err) => {
      console.error('Failed to sync course save with server:', err.response?.status, err.response?.data || err.message);
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
