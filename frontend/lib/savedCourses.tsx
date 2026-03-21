'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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

const SavedCoursesContext = createContext<SavedCoursesContextType>({
  savedIds: new Set(),
  savedCourses: [],
  toggleSave: () => {},
});

export function SavedCoursesProvider({ children }: { children: ReactNode }) {
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get('/courses/saved/list')
      .then((res) => {
        const courses: SavedCourse[] = (res.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          university: c.university,
          type: c.type,
        }));
        setSavedCourses(courses);
        setSavedIds(new Set(courses.map((c) => c.id)));
      })
      .catch(() => {
        // Not logged in or API error — start with empty
      });
  }, []);

  const toggleSave = useCallback((course: SavedCourse) => {
    const isSaved = savedIds.has(course.id);

    // Optimistic update
    const previousCourses = savedCourses;
    const previousIds = savedIds;

    if (isSaved) {
      setSavedCourses((prev) => prev.filter((c) => c.id !== course.id));
      setSavedIds((prev) => { const next = new Set(prev); next.delete(course.id); return next; });
    } else {
      setSavedCourses((prev) => [...prev, course]);
      setSavedIds((prev) => new Set(prev).add(course.id));
    }

    api.post(`/courses/${course.id}/save`).catch(() => {
      // Revert on error
      setSavedCourses(previousCourses);
      setSavedIds(previousIds);
    });
  }, [savedCourses, savedIds]);

  return (
    <SavedCoursesContext.Provider value={{ savedIds, savedCourses, toggleSave }}>
      {children}
    </SavedCoursesContext.Provider>
  );
}

export function useSavedCourses() {
  return useContext(SavedCoursesContext);
}
