'use client';

import { create } from 'zustand';
import type { AppNotification, PresenceEntry } from '@/lib/schemas';

export type ConnectionStatus = 'offline' | 'connecting' | 'online';

interface NotificationState {
  items: AppNotification[];
  /** Notifications affichées en toast (les plus récentes) */
  toasts: AppNotification[];
  presence: PresenceEntry[];
  status: ConnectionStatus;
  setItems: (items: AppNotification[]) => void;
  push: (n: AppNotification) => void;
  dismissToast: (id: string) => void;
  markAllRead: () => void;
  setPresence: (p: PresenceEntry[]) => void;
  setStatus: (s: ConnectionStatus) => void;
  reset: () => void;
}

const MAX_ITEMS = 50;
const MAX_TOASTS = 4;

export const useNotificationStore = create<NotificationState>()((set) => ({
  items: [],
  toasts: [],
  presence: [],
  status: 'offline',
  setItems: (items) =>
    set((s) => {
      // Fusion : l'historique serveur + ce qui est arrivé en temps réel entre-temps
      const known = new Set(items.map((i) => i.id));
      return { items: [...s.items.filter((i) => !known.has(i.id)), ...items].slice(0, MAX_ITEMS) };
    }),
  push: (n) =>
    set((s) =>
      s.items.some((i) => i.id === n.id)
        ? s
        : { items: [n, ...s.items].slice(0, MAX_ITEMS), toasts: [n, ...s.toasts].slice(0, MAX_TOASTS) }
    ),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
  setPresence: (presence) => set({ presence }),
  setStatus: (status) => set({ status }),
  reset: () => set({ items: [], toasts: [], presence: [], status: 'offline' }),
}));

export const selectUnreadCount = (s: NotificationState) => s.items.filter((i) => !i.read).length;
