'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  /** Thème de l'application connectée (clair par défaut) */
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggle: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
    }),
    { name: 'zaff-theme', storage: createJSONStorage(() => localStorage) }
  )
);

/** Applique le thème sur <html data-theme> (palette inversée dans globals.css) */
export function applyTheme(theme: Theme | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#fbf7ef' : '#000000');
}
