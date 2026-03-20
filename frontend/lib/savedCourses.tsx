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
        let courses: SavedCourse[] = [];
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            courses = parsed;
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
        setSavedCourses(courses);
        setSavedIds(new Set(courses.map((c) => c.id)));
      }
    } catch (err) {
      console.error('Failed to load saved courses from localStorage:', err);
    }
  }, []);

  function toggleSave(course: SavedCourse) {
    const isSaved = savedIds.has(course.id);

    let next: SavedCourse[];
    if (isSaved) {
      next = savedCourses.filter((c) => c.id !== course.id);
    } else {
      next = [...savedCourses, course];
    }

    const previousCourses = savedCourses;
    const previousIds = savedIds;

    setSavedCourses(next);
    setSavedIds(new Set(next.map((c) => c.id)));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('Failed to save courses to localStorage:', err);
      setSavedCourses(previousCourses);
      setSavedIds(previousIds);
    }
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
