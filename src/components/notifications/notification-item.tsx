'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Info, PackagePlus, ShoppingBag, Wallet, XCircle } from 'lucide-react';
import type { AppNotification } from '@/lib/schemas';
import { cn } from '@/lib/utils';

const LEVEL_STYLE: Record<AppNotification['level'], string> = {
  success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  info: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  error: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const ICONS = {
  sale: ShoppingBag,
  stock: PackagePlus,
  cash: Wallet,
  error: XCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
} as const;

function iconKey(n: AppNotification): keyof typeof ICONS {
  if (n.type === 'sale.created') return 'sale';
  if (n.type === 'units.added') return 'stock';
  if (n.type.startsWith('cash.')) return 'cash';
  return n.level;
}

/** « il y a 2 min » */
export function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function NotificationItem({
  n,
  currency,
  compact = false,
  className,
}: {
  n: AppNotification;
  currency: string;
  compact?: boolean;
  className?: string;
}) {
  const Icon = ICONS[iconKey(n)];
  const amount = typeof n.data.amount === 'number' ? n.data.amount : null;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center shrink-0', LEVEL_STYLE[n.level])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-white truncate">{n.title}</p>
          {amount !== null && (
            <p className="text-sm font-bold text-[#f5d77f] shrink-0">
              {amount.toLocaleString('fr-FR')} {currency}
            </p>
          )}
        </div>
        <p className={cn('text-xs text-neutral-400', compact ? 'line-clamp-1' : 'line-clamp-2')}>{n.message}</p>
        <p className="text-[10px] text-neutral-500 mt-0.5">
          {timeAgo(n.createdAt)}
          {typeof n.data.invoiceNumber === 'number' && ` · Facture #${n.data.invoiceNumber}`}
        </p>
      </div>
    </div>
  );
}

/** Où mène un clic sur la notification */
export function notificationHref(n: AppNotification): string | null {
  if (n.type === 'sale.created') return '/app/invoices';
  if (n.type === 'stock.low' || n.type === 'units.added') return '/app/stock';
  if (n.type === 'cash.closed') return '/app/cash-closings';
  if (n.type === 'cash.validated') return '/app/cash-closing';
  return null;
}
