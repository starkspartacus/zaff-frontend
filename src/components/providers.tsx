'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { connectRealtime, disconnectRealtime } from '@/lib/realtime';
import { useNotificationsHistory } from '@/lib/queries';
import { isOwner } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { NotificationToaster } from '@/components/notifications/notification-toaster';

/** Ouvre le WebSocket tant qu'une session existe et charge l'historique des notifications */
function RealtimeBridge() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (!token) return;
    connectRealtime(token, queryClient, { isOwner: isOwner(role) });
    return () => {
      disconnectRealtime();
      useNotificationStore.getState().reset();
    };
  }, [token, role, queryClient]);

  const history = useNotificationsHistory(!!token);
  useEffect(() => {
    if (history.data) useNotificationStore.getState().setItems(history.data);
  }, [history.data]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Les données sont rafraîchies par le WebSocket : inutile de les recharger en permanence
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: 0 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      {children}
      <NotificationToaster />
    </QueryClientProvider>
  );
}
