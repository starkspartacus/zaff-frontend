'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Session de l'administrateur de la plateforme ZAFF (/admin), séparée de la session boutique :
 * on peut être connecté aux deux sans qu'elles se mélangent.
 */
interface AdminState {
  token: string | null;
  email: string | null;
  hydrated: boolean;
  setSession: (token: string, email: string) => void;
  clear: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      hydrated: false,
      setSession: (token, email) => set({ token, email }),
      clear: () => set({ token: null, email: null }),
    }),
    {
      name: 'zaff-admin',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, email }) => ({ token, email }),
    }
  )
);

const markHydrated = () => useAdminStore.setState({ hydrated: true });
if (typeof window !== 'undefined') {
  if (useAdminStore.persist.hasHydrated()) markHydrated();
  else useAdminStore.persist.onFinishHydration(markHydrated);
}
