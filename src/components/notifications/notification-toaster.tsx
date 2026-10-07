'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { AnimatedList, AnimatedListItem } from '@/components/magicui/animated-list';
import { useNotificationStore } from '@/stores/notification-store';
import { useAuthStore } from '@/stores/auth-store';
import { NotificationItem, notificationHref } from './notification-item';
import { playChime } from './chime';

const TOAST_MS = 6000;

/** Toasts temps réel (empilés, animés, fermés automatiquement) */
export function NotificationToaster() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismiss = useNotificationStore((s) => s.dismissToast);
  const currency = useAuthStore((s) => s.establishment?.currency || 'F CFA');
  const router = useRouter();

  const newest = toasts[0];
  useEffect(() => {
    if (!newest) return;
    if (newest.type === 'sale.created') playChime();
    const timer = setTimeout(() => dismiss(newest.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [newest, dismiss]);

  // Les toasts plus anciens partent aussi au bout du délai
  useEffect(() => {
    const timers = toasts.slice(1).map((t) => setTimeout(() => dismiss(t.id), TOAST_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div
      aria-live="polite"
      className="fixed z-[60] top-3 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 sm:w-96 pointer-events-none"
    >
      <AnimatedList>
        {toasts.map((t) => {
          const href = notificationHref(t);
          return (
            <AnimatedListItem key={t.id}>
              <div
                role={href ? 'button' : undefined}
                onClick={() => {
                  if (href) router.push(href);
                  dismiss(t.id);
                }}
                className="pointer-events-auto relative rounded-2xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md p-3.5 pr-9 shadow-2xl shadow-black/50 cursor-pointer hover:border-gold/50 transition-colors"
              >
                <NotificationItem n={t} currency={currency} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(t.id);
                  }}
                  className="absolute top-2.5 right-2.5 p-1 text-neutral-500 hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </AnimatedListItem>
          );
        })}
      </AnimatedList>
    </div>
  );
}
