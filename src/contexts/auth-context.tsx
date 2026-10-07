'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { normalizeRole, ROLE_HOME, type Role } from '@/lib/roles';

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: Role;
}

export interface Establishment {
  id: string;
  name: string;
  slug: string;
  currency: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  establishment: Establishment | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, pass: string, tenantSlug?: string) => Promise<void>;
  registerEstablishment: (data: any) => Promise<any>;
  logout: () => void;
  selectTenant: (slug: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('zaff_token');
      const storedUser = localStorage.getItem('zaff_user');
      const storedEst = localStorage.getItem('zaff_establishment');

      if (storedToken && storedUser && storedEst) {
        setToken(storedToken);
        const parsed = JSON.parse(storedUser);
        setUser({ ...parsed, role: normalizeRole(parsed.role) });
        setEstablishment(JSON.parse(storedEst));
      }
    } catch (e) {
      console.error('Error loading auth from localStorage:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, pass: string, tenantSlug?: string) => {
    setIsLoading(true);
    try {
      const res: any = await api.post('/auth/login', {
        identifier,
        password: pass,
        tenantSlug: tenantSlug || undefined,
      });

      const { accessToken, establishment: estData } = res;
      const userData: UserProfile = { ...res.user, role: normalizeRole(res.user?.role) };
      setToken(accessToken);
      setUser(userData);
      setEstablishment(estData);

      localStorage.setItem('zaff_token', accessToken);
      localStorage.setItem('zaff_user', JSON.stringify(userData));
      localStorage.setItem('zaff_establishment', JSON.stringify(estData));
      localStorage.setItem('zaff_tenant_slug', estData.slug);

      router.push(ROLE_HOME[userData.role]);
    } finally {
      setIsLoading(false);
    }
  };

  const registerEstablishment = async (data: any) => {
    const res = await api.post('/global/establishments', data);
    return res;
  };

  const selectTenant = (slug: string) => {
    localStorage.setItem('zaff_tenant_slug', slug);
  };

  const logout = () => {
    setUser(null);
    setEstablishment(null);
    setToken(null);
    localStorage.removeItem('zaff_token');
    localStorage.removeItem('zaff_user');
    localStorage.removeItem('zaff_establishment');
    localStorage.removeItem('zaff_tenant_slug');
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        establishment,
        token,
        isLoading,
        login,
        registerEstablishment,
        logout,
        selectTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}