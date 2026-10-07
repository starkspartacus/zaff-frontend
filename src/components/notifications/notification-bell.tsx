'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { AnimatedList, AnimatedListItem } from '@/components/magicui/animated-list';
import { AnimatedShinyText } from '@/components/magicui/animated-shiny-text';
import { selectUnreadCount, useNotificationStore } from '@/stores/notification-store';
import { useAuthStore } from '@/stores/auth-store';
import { NotificationItem, notificationHref } from './notification-item';
import { PushToggle } from './push-toggle';
import { cn } from '@/lib/utils';

/** Indicateur de connexion temps réel */
export function LiveStatus({ className }: { className?: string }) {
  const status = useNotificationStore((s) => s.status);
  return (
    <span className={cn('flex items-center gap-1.5 text-[11px]', className)} title="Connexion temps réel">
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'online' ? 'bg-emerald-500 animate-pulse' : status === 'connecting' ? 'bg-amber-500' : 'bg-neutral-600'
        )}
      />
      {status === 'online' ? (
        <AnimatedShinyText className="font-semibold">En direct</AnimatedShinyText>
      ) : (
        <span className="text-neutral-500">{status === 'connecting' ? 'Reconnexion…' : 'Hors ligne'}</span>
      )}
    </span>
  );
}

/** Cloche + centre de notifications */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const items = useNotificationStore((s) => s.items);
  const unread = useNotificationStore(selectUnreadCount);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const currency = useAuthStore((s) => s.establishment?.currency || 'F CFA');

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const readAll = () => {
    markAllRead(); // optimiste
    api.patch('/notifications/read-all').catch(() => undefined);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[10px] font-black flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
            <span className="absolute inset-0 rounded-full bg-gold animate-ping opacity-40" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] rounded-3xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900">
            <div>
              <p className="text-sm font-bold text-white">Notifications</p>
              <LiveStatus />
            </div>
            {unread > 0 && (
              <button onClick={readAll} className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="text-center text-sm text-neutral-500 py-10">Aucune notification pour le moment.</p>
            ) : (
              <AnimatedList className="gap-1">
                {items.map((n) => {
                  const href = notificationHref(n);
                  return (
                    <AnimatedListItem key={n.id}>
                      <button
                        onClick={() => {
                          if (href) router.push(href);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full text-left rounded-2xl px-3 py-2.5 hover:bg-neutral-900 transition-colors relative',
                          !n.read && 'bg-gold/5'
                        )}
                      >
                        {!n.read && <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold" />}
                        <NotificationItem n={n} currency={currency} compact />
                      </button>
                    </AnimatedListItem>
                  );
                })}
              </AnimatedList>
            )}
          </div>
          <PushToggle />
        </div>
      )}
    </div>
  );
}
