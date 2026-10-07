'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { disablePush } from '@/lib/push';
import { normalizeRole, ROLE_HOME } from '@/lib/roles';
import { useAuthStore, type Establishment, type UserProfile } from '@/stores/auth-store';

export type { Establishment, UserProfile };

interface LoginResponse {
  accessToken: string;
  user: UserProfile;
  establishment: Establishment;
}

/**
 * Accès à la session (store Zustand persistant) et aux actions de connexion.
 * Même API qu'avant pour les pages : { user, establishment, token, isLoading, login, logout, … }.
 */
export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const establishment = useAuthStore((s) => s.establishment);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const pending = useAuthStore((s) => s.pending);

  const login = async (identifier: string, password: string, tenantSlug?: string, countryCode?: string) => {
    const { setPending, setSession } = useAuthStore.getState();
    setPending(true);
    try {
      const res = (await api.post('/auth/login', {
        identifier,
        password,
        tenantSlug: tenantSlug || undefined,
        countryCode: countryCode || undefined,
      })) as unknown as LoginResponse;
      const sessionUser = { ...res.user, role: normalizeRole(res.user?.role) };
      queryClient.clear(); // aucune donnée d'une autre session ne doit subsister
      setSession({ token: res.accessToken, user: sessionUser, establishment: res.establishment });
      router.push(ROLE_HOME[sessionUser.role]);
    } finally {
      setPending(false);
    }
  };

  const registerEstablishment = (data: Record<string, unknown>) =>
    api.post('/global/establishments', data) as unknown as Promise<{ slug?: string; name?: string }>;

  const logout = async () => {
    // L'appareil ne doit plus recevoir les notifications de ce compte
    await Promise.race([disablePush().catch(() => undefined), new Promise((r) => setTimeout(r, 1500))]);
    useAuthStore.getState().clear();
    queryClient.clear();
    router.push('/login');
  };

  return {
    user,
    establishment,
    token,
    isLoading: !hydrated || pending,
    login,
    registerEstablishment,
    logout,
  };
}
