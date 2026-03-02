import React, { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '@/lib/backend-auth';
import { usersApi } from '@/lib/backend-users';
import type { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('nextios_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const u = await authApi.login(email, password);
      if (u) {
        setUser(u);
        localStorage.setItem('nextios_user', JSON.stringify(u));
        return true;
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await usersApi.getUserInfo();
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...u };
        localStorage.setItem('nextios_user', JSON.stringify(next));
        return next;
      });
    } catch {
      // ignore: session may be invalid or network error
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    void authApi.logout();
    localStorage.removeItem('nextios_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
