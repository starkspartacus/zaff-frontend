'use client';

import { io, type Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';
import { API_ORIGIN } from '@/lib/env';
import { InvalidateSchema, NotificationSchema, PresenceSchema } from '@/lib/schemas';
import { useNotificationStore } from '@/stores/notification-store';

let socket: Socket | null = null;

/**
 * Connexion WebSocket unique de l'onglet. Les événements serveur alimentent le store
 * de notifications et invalident uniquement les requêtes React Query concernées.
 */
export function connectRealtime(token: string, queryClient: QueryClient, { isOwner }: { isOwner: boolean }) {
  disconnectRealtime();
  const store = useNotificationStore.getState();
  store.setStatus('connecting');

  const s = io(`${API_ORIGIN}/realtime`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  socket = s;

  // Regroupe les invalidations reçues en rafale (ex. vente = plusieurs événements)
  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduleInvalidate = (scopes: string[]) => {
    scopes.forEach((x) => pending.add(x));
    if (timer) return;
    timer = setTimeout(() => {
      const scopesNow = pending;
      pending = new Set();
      timer = null;
      scopesNow.forEach((scope) => queryClient.invalidateQueries({ queryKey: [scope] }));
    }, 250);
  };

  let wasConnected = false;
  s.on('connect', async () => {
    useNotificationStore.getState().setStatus('online');
    if (wasConnected) {
      // Reconnexion : on rattrape ce qui a pu être manqué pendant la coupure
      queryClient.invalidateQueries();
    }
    wasConnected = true;
    if (isOwner) {
      const presence = PresenceSchema.safeParse(await s.emitWithAck('presence:get', {}).catch(() => []));
      if (presence.success) useNotificationStore.getState().setPresence(presence.data);
    }
  });
  s.on('disconnect', () => useNotificationStore.getState().setStatus('connecting'));
  s.on('connect_error', () => useNotificationStore.getState().setStatus('connecting'));

  s.on('notification', (raw: unknown) => {
    const parsed = NotificationSchema.safeParse(raw);
    if (parsed.success) useNotificationStore.getState().push(parsed.data);
  });

  s.on('data:invalidate', (raw: unknown) => {
    const parsed = InvalidateSchema.safeParse(raw);
    if (parsed.success) scheduleInvalidate(parsed.data.scopes);
  });

  s.on('presence', (raw: unknown) => {
    const parsed = PresenceSchema.safeParse(raw);
    if (parsed.success) useNotificationStore.getState().setPresence(parsed.data);
  });

  return s;
}

export function disconnectRealtime() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  useNotificationStore.getState().setStatus('offline');
}
