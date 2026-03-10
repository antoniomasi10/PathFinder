'use client';

import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  profileCompleted: boolean;
  university?: { id: string; name: string } | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
