'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SavedCourse {
  id: number;
  title: string;
  university: string;
  city: string;
}

interface SavedCoursesContextType {
  savedIds: Set<number>;
  savedCourses: SavedCourse[];
  toggleSave: (course: SavedCourse) => void;
}

const SavedCoursesContext = createContext<SavedCoursesContextType>({
  savedIds: new Set(),
  savedCourses: [],
  toggleSave: () => {},
});

const STORAGE_KEY = 'pathfinder-saved-courses';

export function SavedCoursesProvider({ children }: { children: ReactNode }) {
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const courses: SavedCourse[] = JSON.parse(stored);
        setSavedCourses(courses);
        setSavedIds(new Set(courses.map((c) => c.id)));
      }
    } catch {}
  }, []);

  function toggleSave(course: SavedCourse) {
    const isSaved = savedIds.has(course.id);

    let next: SavedCourse[];
    if (isSaved) {
      next = savedCourses.filter((c) => c.id !== course.id);
    } else {
      next = [...savedCourses, course];
    }

    setSavedCourses(next);
    setSavedIds(new Set(next.map((c) => c.id)));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
