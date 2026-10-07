'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, Lock, ReceiptText, ScanLine, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useCloseRegister, useClosings, useCurrentRegister } from '@/lib/queries';
import { CloseRegisterSchema } from '@/lib/schemas';
import { errorMessage, PAYMENT_LABELS, type CashClosing, type PaymentTotals } from '@/lib/types';
import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { ClosingStatus, DifferenceBadge, PaymentBreakdown, dateTime, money } from '@/components/cash/closing-ui';

export default function CashClosingPage() {
  const { establishment } = useAuth();
  const currency = establishment?.currency || 'F CFA';
  const { data: register, isLoading } = useCurrentRegister();
  const { data: history = [] } = useClosings(30);
  const closeRegister = useCloseRegister();

  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ declaredCash: number; notes?: string } | null>(null);
  const [showSales, setShowSales] = useState(false);
  const [done, setDone] = useState<CashClosing | null>(null);

  const expected = register?.expectedCash ?? 0;
  const parsed = CloseRegisterSchema.safeParse({ declaredCash: counted, notes });
  const difference = parsed.success ? parsed.data.declaredCash - expected : null;

  const askConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Vérifiez le montant.');
      return;
    }
    if (difference !== 0 && !parsed.data.notes) {
      setError("Il y a un écart : expliquez-le en une phrase pour votre responsable.");
      return;
    }
    setConfirming(parsed.data);
  };

  const submit = async () => {
    if (!confirming) return;
    try {
      const closing = await closeRegister.mutateAsync(confirming);
      setDone(closing);
      setConfirming(null);
      setCounted('');
      setNotes('');
    } catch (err) {
      setConfirming(null);
      setError(errorMessage(err));
    }
  };

  // ─── Clôture réussie ───
  if (done) {
    return (
      <BlurFade className="max-w-xl mx-auto space-y-5">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
          <div>
            <p className="text-2xl font-black text-white">Caisse clôturée</p>
            <p className="text-sm text-neutral-400 mt-1">
              {done.salesCount} vente{done.salesCount > 1 ? 's' : ''} · {dateTime(done.openedAt)} → {dateTime(done.closedAt)}
            </p>
          </div>
          <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4 text-left space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">À remettre à votre responsable</p>
            <PaymentBreakdown totals={done.totals} currency={currency} />
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-neutral-400">Espèces comptées : {money(done.declaredCash, currency)}</span>
              <DifferenceBadge difference={done.cashDifference} currency={currency} />
            </div>
          </div>
          <p className="text-xs text-neutral-400">Votre responsable a été prévenu. Vous serez notifié dès qu&apos;il confirme la réception.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setDone(null)} className="h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold">
              Mes clôtures
            </button>
            <Link href="/app/scan" className="h-12 rounded-2xl bg-gold text-ink text-sm font-bold flex items-center justify-center gap-2">
              <ScanLine className="w-4 h-4" /> Nouvelle vente
            </Link>
          </div>
        </div>
      </BlurFade>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Lock className="w-6 h-6 text-gold" /> Ma caisse
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          {register?.since
            ? `Ventes depuis ${dateTime(register.since)}`
            : register?.lastClosedAt
            ? `Dernière clôture : ${dateTime(register.lastClosedAt)}`
            : 'Fin de journée : comptez votre caisse et clôturez.'}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-neutral-800 p-10 text-center text-neutral-500 text-sm">Chargement de votre caisse…</div>
      ) : !register || register.salesCount === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 p-8 text-center space-y-2">
          <ReceiptText className="w-10 h-10 mx-auto text-neutral-600" />
          <p className="text-sm text-white font-semibold">Aucune vente à clôturer</p>
          <p className="text-xs text-neutral-500">Vos prochaines ventes apparaîtront ici jusqu&apos;à la prochaine clôture.</p>
        </div>
      ) : (
        <>
          {/* Ce qu'il y a dans la caisse */}
          <BlurFade className="relative rounded-3xl border border-neutral-800 bg-neutral-950 p-5 space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Total encaissé</p>
                <p className="text-3xl font-black text-gold-soft">
                  <NumberTicker value={register.totalAmount} suffix={currency} />
                </p>
              </div>
              <p className="text-xs text-neutral-400 text-right">
                {register.salesCount} vente{register.salesCount > 1 ? 's' : ''}
                <br />
                {register.itemsCount} article{register.itemsCount > 1 ? 's' : ''}
              </p>
            </div>
            <PaymentBreakdown totals={register.totals} currency={currency} />

            <button onClick={() => setShowSales((v) => !v)} className="w-full flex items-center justify-between text-xs text-neutral-400 hover:text-white pt-1">
              <span>Voir le détail des ventes</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showSales ? 'rotate-180' : ''}`} />
            </button>
            {showSales && (
              <div className="divide-y divide-neutral-900 max-h-72 overflow-y-auto -mx-1">
                {register.sales.map((s) => (
                  <div key={s._id} className="flex items-center justify-between gap-3 px-1 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-white truncate">{s.items.map((i) => i.productName).join(', ')}</p>
                      <p className="text-[10px] text-neutral-500">
                        #{s.invoiceNumber} · {new Date(s.saleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                        {PAYMENT_LABELS[s.paymentMethod as keyof PaymentTotals] || s.paymentMethod}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-white shrink-0">{money(s.total, currency)}</p>
                  </div>
                ))}
              </div>
            )}
          </BlurFade>

          {/* Comptage */}
          <form onSubmit={askConfirm} className="relative rounded-3xl border border-gold/40 bg-neutral-950 p-5 space-y-4">
            <BorderBeam size={110} duration={7} />
            <div>
              <label htmlFor="counted" className="text-sm font-semibold text-white">
                Combien d&apos;espèces avez-vous dans la caisse ?
              </label>
              <p className="text-xs text-neutral-500 mt-0.5">Attendu : {money(expected, currency)}</p>
            </div>
            <div className="relative">
              <input
                id="counted"
                inputMode="numeric"
                autoComplete="off"
                value={counted}
                onChange={(e) => {
                  setCounted(e.target.value);
                  setError(null);
                }}
                placeholder="Montant compté"
                className="w-full h-14 pl-4 pr-16 rounded-2xl bg-neutral-900 border border-neutral-800 text-2xl font-black text-white placeholder:text-base placeholder:font-normal placeholder:text-neutral-500 focus:outline-none focus:border-gold"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">{currency}</span>
            </div>
            <div className="flex items-center justify-between gap-2 min-h-7">
              {difference !== null ? <DifferenceBadge difference={difference} currency={currency} /> : <span />}
              {expected > 0 && counted === '' && (
                <button type="button" onClick={() => setCounted(String(expected))} className="text-[11px] text-neutral-400 hover:text-white underline underline-offset-2">
                  J&apos;ai compté : montant exact
                </button>
              )}
            </div>
            {difference !== null && difference !== 0 && (
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setError(null);
                }}
                placeholder="Expliquez l'écart (ex. monnaie rendue en trop, billet abîmé…)"
                className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-3 text-sm text-white focus:outline-none focus:border-gold"
              />
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-base hover:brightness-110 flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
            >
              <Lock className="w-5 h-5" /> Clôturer ma caisse
            </button>
          </form>
        </>
      )}

      {/* Historique */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Mes dernières clôtures</p>
        {history.length === 0 ? (
          <p className="text-center text-sm text-neutral-500 py-4">Aucune clôture sur les 30 derniers jours.</p>
        ) : (
          history.map((c) => (
            <div key={c._id} className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{dateTime(c.closedAt)}</p>
                <p className="text-sm font-bold text-gold-soft">{money(c.totalAmount, currency)}</p>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
                <span>
                  {c.salesCount} vente{c.salesCount > 1 ? 's' : ''} · espèces {money(c.declaredCash, currency)}
                </span>
                {c.cashDifference !== 0 && <DifferenceBadge difference={c.cashDifference} currency={currency} className="py-0.5 text-[10px]" />}
              </div>
              <ClosingStatus closing={c} />
            </div>
          ))
        )}
      </div>

      {/* Confirmation */}
      {confirming && register && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <BlurFade className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-6 space-y-4 relative">
            <button onClick={() => setConfirming(null)} className="absolute top-4 right-4 p-1 text-neutral-500 hover:text-white" aria-label="Annuler">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-white">Confirmer la clôture ?</h2>
            <p className="text-sm text-neutral-300">
              Vous remettez <strong className="text-gold-soft">{money(confirming.declaredCash, currency)}</strong> en espèces
              {register.totals.mobile > 0 && (
                <>
                  {' '}et <strong className="text-sky-300">{money(register.totals.mobile, currency)}</strong> en Mobile Money
                </>
              )}{' '}
              pour {register.salesCount} vente{register.salesCount > 1 ? 's' : ''}.
            </p>
            {difference !== null && <DifferenceBadge difference={difference} currency={currency} />}
            <p className="text-xs text-neutral-500">Après la clôture, ces ventes ne peuvent plus être modifiées dans votre caisse.</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setConfirming(null)} className="h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-300 font-bold text-sm">
                Non
              </button>
              <button
                onClick={submit}
                disabled={closeRegister.isPending}
                className="col-span-2 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {closeRegister.isPending ? (
                  <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Oui, clôturer
                  </>
                )}
              </button>
            </div>
          </BlurFade>
        </div>
      )}
    </div>
  );
}
