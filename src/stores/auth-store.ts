'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeRole, type Role } from '@/lib/roles';

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

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  establishment: Establishment | null;
  hydrated: boolean;
  /** Connexion en cours (non persisté) */
  pending: boolean;
  setPending: (pending: boolean) => void;
  setSession: (s: { token: string; user: UserProfile; establishment: Establishment }) => void;
  clear: () => void;
}

const LEGACY_KEYS = ['zaff_token', 'zaff_user', 'zaff_establishment', 'zaff_tenant_slug'];

/** Session (persistée) : jeton, utilisateur, boutique. Lue hors React par le client API et le WebSocket. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      establishment: null,
      hydrated: false,
      pending: false,
      setPending: (pending) => set({ pending }),
      setSession: ({ token, user, establishment }) =>
        set({ token, user: { ...user, role: normalizeRole(user.role) }, establishment }),
      clear: () => set({ token: null, user: null, establishment: null }),
    }),
    {
      name: 'zaff-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, user, establishment }) => ({ token, user, establishment }),
      onRehydrateStorage: () => (state) => {
        // Reprise d'une session ouverte avec l'ancienne version (clés séparées)
        try {
          if (state && !state.token && localStorage.getItem('zaff_token')) {
            const user = JSON.parse(localStorage.getItem('zaff_user') || 'null');
            const establishment = JSON.parse(localStorage.getItem('zaff_establishment') || 'null');
            if (user && establishment) {
              state.setSession({ token: localStorage.getItem('zaff_token')!, user, establishment });
            }
          }
          LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
        } catch {
          // stockage indisponible (navigation privée) : on repart d'une session vide
        }
      },
    }
  )
);

// La restauration depuis localStorage est synchrone et peut finir avant l'affectation de
// `useAuthStore` : on signale la fin de l'hydratation une fois le store créé.
const markHydrated = () => useAuthStore.setState({ hydrated: true });
if (typeof window !== 'undefined') {
  if (useAuthStore.persist.hasHydrated()) markHydrated();
  else useAuthStore.persist.onFinishHydration(markHydrated);
}
