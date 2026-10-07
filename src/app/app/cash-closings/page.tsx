'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, HandCoins, Lock, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useClosings, useOpenRegisters, useValidateClosing } from '@/lib/queries';
import { errorMessage, type CashClosing } from '@/lib/types';
import { BlurFade } from '@/components/magicui/blur-fade';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { AnimatedList, AnimatedListItem } from '@/components/magicui/animated-list';
import { LiveStatus } from '@/components/notifications/notification-bell';
import { ClosingStatus, DifferenceBadge, PaymentBreakdown, dateTime, money } from '@/components/cash/closing-ui';

export default function OwnerCashClosingsPage() {
  const { establishment } = useAuth();
  const currency = establishment?.currency || 'F CFA';
  const { data: open = [] } = useOpenRegisters();
  const { data: closings = [], isLoading } = useClosings(30);
  const validate = useValidateClosing();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = closings.filter((c) => c.status === 'submitted');
  const validated = closings.filter((c) => c.status === 'validated');

  // Espèces encore entre les mains des vendeurs (caisses ouvertes + clôtures non validées)
  const cashOutstanding = useMemo(
    () => open.reduce((s, r) => s + r.totals.cash, 0) + pending.reduce((s, c) => s + c.declaredCash, 0),
    [open, pending]
  );

  const confirm = async (c: CashClosing) => {
    setError(null);
    setBusyId(c._id);
    try {
      await validate.mutateAsync({ id: c._id });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-gold" /> Clôtures de caisse
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">Ce que chaque vendeur doit vous remettre, et les caisses à valider</p>
        </div>
        <LiveStatus />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Espèces chez les vendeurs" value={cashOutstanding} currency={currency} highlight />
        <Kpi label="Caisses ouvertes" value={open.length} />
        <Kpi label="Clôtures à valider" value={pending.length} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* À valider */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-gold" /> À valider ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-neutral-500 rounded-2xl border border-dashed border-neutral-800 p-6 text-center">
            {isLoading ? 'Chargement…' : 'Aucune clôture en attente.'}
          </p>
        ) : (
          <AnimatedList>
            {pending.map((c) => (
              <AnimatedListItem key={c._id}>
                <div className="rounded-3xl border border-gold/30 bg-neutral-950 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.sellerName} />
                      <div>
                        <p className="font-semibold text-white">{c.sellerName}</p>
                        <p className="text-[11px] text-neutral-400">
                          Clôturée {dateTime(c.closedAt)} · {c.salesCount} vente{c.salesCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-gold-soft shrink-0">{money(c.totalAmount, currency)}</p>
                  </div>
                  <PaymentBreakdown totals={c.totals} currency={currency} compact />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
                    <span>
                      Espèces attendues {money(c.expectedCash, currency)} · comptées <strong className="text-white">{money(c.declaredCash, currency)}</strong>
                    </span>
                    <DifferenceBadge difference={c.cashDifference} currency={currency} />
                  </div>
                  {c.notes && <p className="text-xs text-neutral-300 rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2">« {c.notes} »</p>}
                  <button
                    onClick={() => confirm(c)}
                    disabled={busyId === c._id}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> J&apos;ai reçu {money(c.declaredCash, currency)} en espèces
                    {c.totals.mobile > 0 && ` + ${money(c.totals.mobile, currency)} Mobile Money`}
                  </button>
                </div>
              </AnimatedListItem>
            ))}
          </AnimatedList>
        )}
      </section>

      {/* Caisses ouvertes */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-gold" /> Caisses encore ouvertes ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-neutral-500 rounded-2xl border border-dashed border-neutral-800 p-6 text-center">
            Toutes les caisses sont clôturées.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {open.map((r) => (
              <BlurFade key={r.sellerId} className="rounded-3xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.sellerName} />
                    <div>
                      <p className="font-semibold text-white">{r.sellerName}</p>
                      <p className="text-[11px] text-neutral-400">
                        {r.salesCount} vente{r.salesCount > 1 ? 's' : ''} depuis {dateTime(r.since)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gold-soft">{money(r.totalAmount, currency)}</p>
                </div>
                <PaymentBreakdown totals={r.totals} currency={currency} compact />
              </BlurFade>
            ))}
          </div>
        )}
      </section>

      {/* Historique */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <HandCoins className="w-4 h-4 text-gold" /> Validées (30 derniers jours)
        </h2>
        <div className="rounded-3xl border border-neutral-800 bg-neutral-950 overflow-hidden">
          {validated.length === 0 ? (
            <p className="text-sm text-neutral-500 p-6 text-center">Aucune clôture validée sur la période.</p>
          ) : (
            <div className="divide-y divide-neutral-900">
              {validated.map((c) => (
                <div key={c._id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white">
                      <strong>{c.sellerName}</strong> · {dateTime(c.closedAt)}
                    </p>
                    <ClosingStatus closing={c} />
                  </div>
                  <div className="flex items-center gap-3">
                    {c.cashDifference !== 0 && <DifferenceBadge difference={c.cashDifference} currency={currency} className="text-[10px] py-0.5" />}
                    <p className="text-sm font-bold text-gold-soft">{money(c.totalAmount, currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, currency, highlight = false }: { label: string; value: number; currency?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? 'border-gold/40 bg-gold/5' : 'border-neutral-800 bg-neutral-950'}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`text-2xl font-black mt-1 ${highlight ? 'text-gold-soft' : 'text-white'}`}>
        <NumberTicker value={value} suffix={currency} />
      </p>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-gold to-amber-200 text-ink font-bold text-xs flex items-center justify-center shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
