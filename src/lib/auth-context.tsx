'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User, LoginRequest } from '@/types';
import { api } from './api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  selectOrg: (orgId: string) => Promise<void>;
  currentOrgId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    console.log('[Auth] Loading user...');
    try {
      const currentUser = await api.getCurrentUser();
      console.log('[Auth] User loaded:', currentUser?.email);
      setUser(currentUser);
    } catch (error) {
      console.log('[Auth] Not authenticated:', error);
      // Not authenticated
      setUser(null);
    } finally {
      console.log('[Auth] Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginRequest) => {
    const response = await api.login(credentials);
    setUser(response.user);

    // Redirect to org selector if user has multiple orgs, otherwise to dashboard
    if (response.user.orgs.length > 1) {
      router.push('/select-org');
    } else if (response.user.orgs.length === 1) {
      // Automatically select the only org available
      const selectResponse = await api.selectOrg(response.user.orgs[0].id);
      // Update user with the selected org
      response.user.currentOrgId = response.user.orgs[0].id;
      setUser(response.user);
      router.push('/');
    } else {
      throw new Error('No organizations available');
    }
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    router.push('/login');
  };

  const selectOrg = async (orgId: string) => {
    const response = await api.selectOrg(orgId);
    // The API returns a new access token with currentOrgId in the JWT
    // Update the user object to reflect the selected org
    if (user) {
      setUser({ ...user, currentOrgId: orgId });
    }
    router.push('/');
  };

  const currentOrgId = user?.currentOrgId || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        selectOrg,
        currentOrgId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
