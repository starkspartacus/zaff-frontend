'use client';

import React from 'react';
import { Banknote, CheckCircle2, Clock, CreditCard, Landmark, Smartphone, HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAYMENT_LABELS, type CashClosing, type PaymentTotals } from '@/lib/types';

export const money = (v: number, currency: string) => `${Math.round(v || 0).toLocaleString('fr-FR')} ${currency}`;

export const dateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const ICONS: Record<keyof PaymentTotals, React.ElementType> = {
  cash: Banknote,
  mobile: Smartphone,
  card: CreditCard,
  bank_transfer: Landmark,
  credit: HandCoins,
};

/** Montants par mode de paiement (espèces et Mobile Money en avant : ce sont eux qu'on remet) */
export function PaymentBreakdown({ totals, currency, compact = false }: { totals: PaymentTotals; currency: string; compact?: boolean }) {
  const secondary = (['card', 'bank_transfer', 'credit'] as const).filter((k) => totals[k] > 0);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(['cash', 'mobile'] as const).map((k) => {
          const Icon = ICONS[k];
          return (
            <div
              key={k}
              className={cn(
                'rounded-2xl border p-3',
                k === 'cash' ? 'border-[#d4a017]/40 bg-[#d4a017]/5' : 'border-sky-500/30 bg-sky-500/5'
              )}
            >
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <Icon className={cn('w-3.5 h-3.5', k === 'cash' ? 'text-[#d4a017]' : 'text-sky-400')} /> {PAYMENT_LABELS[k]}
              </p>
              <p className={cn('font-black text-white mt-0.5', compact ? 'text-base' : 'text-xl')}>{money(totals[k], currency)}</p>
            </div>
          );
        })}
      </div>
      {secondary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {secondary.map((k) => {
            const Icon = ICONS[k];
            return (
              <span key={k} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300">
                <Icon className="w-3.5 h-3.5 text-neutral-500" /> {PAYMENT_LABELS[k]} : <strong className="text-white">{money(totals[k], currency)}</strong>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Écart espèces comptées / attendues */
export function DifferenceBadge({ difference, currency, className }: { difference: number; currency: string; className?: string }) {
  const tone =
    difference === 0
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : difference < 0
      ? 'bg-red-500/10 text-red-400 border-red-500/30'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  const text = difference === 0 ? 'Caisse juste' : difference < 0 ? `Il manque ${money(-difference, currency)}` : `Excédent de ${money(difference, currency)}`;
  return <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold', tone, className)}>{text}</span>;
}

export function ClosingStatus({ closing }: { closing: Pick<CashClosing, 'status' | 'validatedByName' | 'validatedAt'> }) {
  return closing.status === 'validated' ? (
    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
      <CheckCircle2 className="w-3.5 h-3.5" /> Validée par {closing.validatedByName || 'le propriétaire'}
      {closing.validatedAt && ` · ${dateTime(closing.validatedAt)}`}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
      <Clock className="w-3.5 h-3.5" /> En attente de validation
    </span>
  );
}
