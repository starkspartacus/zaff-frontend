'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  PackageCheck,
  Printer,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Square,
  SquareCheck,
  Undo2,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { lookupReturn, useCreateReturn, useReturns } from '@/lib/queries';
import { errorMessage, type ProductReturn, type ReturnLookup, type ReturnOption, type ReturnReason } from '@/lib/types';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';
import { money, dateTime } from '@/components/cash/closing-ui';
import { cn } from '@/lib/utils';

type Step =
  | { kind: 'idle' }
  | { kind: 'loading'; code: string }
  | { kind: 'error'; message: string }
  | { kind: 'found'; data: ReturnLookup }
  | { kind: 'done'; result: ProductReturn; data: ReturnLookup };

const ACTION_ICON: Record<ReturnOption['action'], React.ElementType> = {
  exchange: Undo2,
  credit_note: PackageCheck,
  refund: Banknote,
  warranty_repair: ShieldCheck,
  paid_repair: Wrench,
};

const STATUS_AFTER: Record<string, string> = {
  in_stock: 'Remis en stock : il peut être revendu.',
  defective: "Hors stock : repris par la boutique, envoyé à l'atelier.",
  in_repair: "Hors stock : appareil du client, à l'atelier.",
};

export default function ReturnsPage() {
  const { establishment } = useAuth();
  const currency = establishment?.currency || 'F CFA';
  const [step, setStep] = useState<Step>({ kind: 'idle' });

  const handleScan = async (code: string) => {
    setStep({ kind: 'loading', code });
    try {
      const data = await lookupReturn(code);
      scanFeedback(data.changeOfMind.allowed || data.defective.allowed);
      setStep({ kind: 'found', data });
    } catch (err) {
      scanFeedback(false);
      setStep({ kind: 'error', message: errorMessage(err) });
    }
  };

  if (step.kind === 'done') return <ResultScreen result={step.result} data={step.data} currency={currency} onNext={() => setStep({ kind: 'idle' })} />;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Undo2 className="w-6 h-6 text-gold" /> Retours & garantie
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">Scannez l&apos;appareil rapporté par le client</p>
      </div>

      {step.kind !== 'found' && <BarcodeScanner onScan={handleScan} paused={step.kind === 'loading'} placeholder="Scannez le N° de série / IMEI de l'appareil rapporté" />}

      {step.kind === 'idle' && (
        <div className="rounded-3xl border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-400 space-y-1">
          <ScanLine className="w-9 h-9 mx-auto text-neutral-600" />
          <p>L&apos;application retrouve la vente, la garantie et les solutions autorisées par la boutique.</p>
        </div>
      )}
      {step.kind === 'loading' && <p className="text-center text-sm text-neutral-400">Recherche de {step.code}…</p>}
      {step.kind === 'error' && (
        <BlurFade className="rounded-3xl border border-red-500/30 bg-red-500/5 p-5 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 text-red-400 mx-auto" />
          <p className="text-sm font-semibold text-white">{step.message}</p>
          <button onClick={() => setStep({ kind: 'idle' })} className="text-xs text-neutral-400 underline underline-offset-2">
            Scanner un autre appareil
          </button>
        </BlurFade>
      )}
      {step.kind === 'found' && (
        <ReturnFlow data={step.data} currency={currency} onCancel={() => setStep({ kind: 'idle' })} onDone={(result) => setStep({ kind: 'done', result, data: step.data })} />
      )}

      {step.kind === 'idle' && <History currency={currency} />}
    </div>
  );
}

function ReturnFlow({ data, currency, onCancel, onDone }: { data: ReturnLookup; currency: string; onCancel: () => void; onDone: (r: ProductReturn) => void }) {
  const createReturn = useCreateReturn();
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [issue, setIssue] = useState('');
  const [option, setOption] = useState<ReturnOption | null>(null);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'mobile'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branch = reason === 'change_of_mind' ? data.changeOfMind : reason === 'defective' ? data.defective : null;
  const allChecked = data.changeOfMind.conditions.every((c) => checked.includes(c));
  const ready = reason === 'change_of_mind' ? allChecked : reason === 'defective' ? issue.trim().length >= 3 : false;
  const needsCustomer = !data.sale.customer && !!option && option.action !== 'refund';
  const details = [data.product?.brand, data.product?.model, data.product?.color].filter(Boolean).join(' · ');

  const pickReason = (r: ReturnReason) => {
    setReason(r);
    setOption(null);
    setError(null);
  };

  const submit = async () => {
    if (!option || !reason) return;
    setError(null);
    try {
      const result = await createReturn.mutateAsync({
        serialNumber: data.serialNumber,
        reason,
        action: option.action,
        refundMethod: option.action === 'refund' ? refundMethod : undefined,
        conditionsChecked: reason === 'change_of_mind' ? checked : [],
        issueDescription: reason === 'defective' ? issue.trim() : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      scanFeedback(true);
      onDone(result);
    } catch (err) {
      setConfirming(false);
      setError(errorMessage(err));
    }
  };

  const stageText =
    data.defective.stage === 'early'
      ? `Panne dans les premiers jours (achat il y a ${data.daysSincePurchase} j)`
      : data.underWarranty
      ? `Sous garantie jusqu'au ${new Date(data.warrantyEnd!).toLocaleDateString('fr-FR')}`
      : data.warrantyEnd
      ? `Garantie terminée le ${new Date(data.warrantyEnd).toLocaleDateString('fr-FR')}`
      : 'Sans garantie';

  return (
    <BlurFade className="space-y-4">
      {/* Fiche de l'appareil et de la vente */}
      <div className="relative rounded-3xl border border-neutral-800 bg-neutral-950 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-white leading-tight">{data.product?.name || 'Appareil'}</p>
            {details && <p className="text-sm text-neutral-400">{details}</p>}
            <p className="mt-1.5 inline-block px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-xs text-neutral-300">N° {data.serialNumber}</p>
          </div>
          <button onClick={onCancel} className="p-1 text-neutral-500 hover:text-white" aria-label="Annuler">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="Facture" value={`#${data.sale.invoiceNumber}`} />
          <Info label="Prix payé" value={money(data.price, currency)} />
          <Info label="Achat" value={`${new Date(data.sale.saleDate).toLocaleDateString('fr-FR')} (il y a ${data.daysSincePurchase} j)`} />
          <Info label="Client" value={data.sale.customer?.name || 'Client comptant'} />
        </div>
        <p className={cn('text-xs flex items-center gap-1.5', data.underWarranty ? 'text-emerald-400' : 'text-neutral-400')}>
          <ShieldCheck className="w-4 h-4" /> {stageText}
        </p>
      </div>

      {/* 1. Motif */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-white">Pourquoi le client rapporte-t-il l&apos;appareil ?</p>
        <div className="grid grid-cols-2 gap-2">
          <ReasonButton active={reason === 'change_of_mind'} onClick={() => pickReason('change_of_mind')} icon={Undo2} label="Il a changé d'avis" sub="Appareil en bon état" />
          <ReasonButton active={reason === 'defective'} onClick={() => pickReason('defective')} icon={Wrench} label="Il est en panne" sub="Défaut constaté" />
        </div>
      </div>

      {branch && !branch.allowed && (
        <BlurFade className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {branch.reason}
        </BlurFade>
      )}

      {/* 2. Vérifications */}
      {reason === 'change_of_mind' && data.changeOfMind.allowed && (
        <BlurFade className="rounded-3xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
          <p className="text-sm font-semibold text-white">Vérifiez l&apos;appareil avec le client</p>
          {data.changeOfMind.conditions.map((c) => {
            const on = checked.includes(c);
            return (
              <button
                key={c}
                onClick={() => setChecked(on ? checked.filter((x) => x !== c) : [...checked, c])}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm',
                  on ? 'border-emerald-500/40 bg-emerald-500/5 text-white' : 'border-neutral-800 bg-neutral-900 text-neutral-300'
                )}
              >
                {on ? <SquareCheck className="w-5 h-5 text-emerald-400 shrink-0" /> : <Square className="w-5 h-5 text-neutral-500 shrink-0" />} {c}
              </button>
            );
          })}
          {!allChecked && <p className="text-[11px] text-amber-400">Toutes les conditions doivent être remplies pour accepter le retour.</p>}
          {data.changeOfMind.fee > 0 && <p className="text-[11px] text-neutral-400">Frais de remise en stock : {money(data.changeOfMind.fee, currency)}</p>}
        </BlurFade>
      )}
      {reason === 'defective' && data.defective.allowed && (
        <BlurFade className="rounded-3xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
          <label htmlFor="issue" className="text-sm font-semibold text-white">Quelle panne le client constate-t-il ?</label>
          <textarea
            id="issue"
            rows={2}
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Ex. : ne s'allume plus, écran qui clignote, batterie qui ne charge pas…"
            className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-3 text-sm text-white focus:outline-none focus:border-gold"
          />
        </BlurFade>
      )}

      {/* 3. Solutions autorisées par la boutique */}
      {branch?.allowed && ready && (
        <BlurFade className="space-y-2">
          <p className="text-sm font-semibold text-white">Que propose la boutique ?</p>
          {branch.options.map((o) => {
            const Icon = ACTION_ICON[o.action];
            const active = option?.action === o.action;
            return (
              <button
                key={o.action}
                onClick={() => setOption(o)}
                className={cn(
                  'w-full rounded-2xl border p-4 flex items-center gap-3 text-left transition-colors',
                  active ? 'border-gold bg-gold/10' : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600'
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', active ? 'border-gold text-gold' : 'border-neutral-700 text-neutral-400')}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{o.label}</p>
                  <p className="text-xs text-neutral-400">{o.description}</p>
                </div>
                {o.amount !== undefined && <p className="text-sm font-black text-gold-soft shrink-0">{money(o.amount, currency)}</p>}
              </button>
            );
          })}

          {option?.action === 'refund' && (
            <div className="grid grid-cols-2 gap-2">
              {(option.refundMethods || []).map((m) => (
                <button
                  key={m}
                  onClick={() => setRefundMethod(m)}
                  className={cn(
                    'h-12 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2',
                    refundMethod === m ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  )}
                >
                  {m === 'cash' ? <Banknote className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />} {m === 'cash' ? 'Espèces' : 'Mobile Money'}
                </button>
              ))}
            </div>
          )}

          {needsCustomer && (
            <div className="rounded-2xl border border-neutral-800 p-3 space-y-2">
              <p className="text-xs text-neutral-400">Client (facultatif) : pour retrouver l&apos;avoir ou le prévenir de la réparation</p>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nom" className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold" />
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Téléphone" className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold" />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            disabled={!option}
            onClick={() => setConfirming(true)}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-base disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" /> Valider le retour
          </button>
        </BlurFade>
      )}

      {confirming && option && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <BlurFade className="relative w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-6 space-y-4">
            <BorderBeam size={100} duration={6} />
            <h2 className="text-lg font-bold text-white">Confirmer le retour ?</h2>
            <p className="text-sm text-neutral-300">
              {option.label} pour <strong>{data.product?.name}</strong>
              {option.amount !== undefined && (
                <>
                  {' '}: <strong className="text-gold-soft">{money(option.amount, currency)}</strong>
                  {option.action === 'refund' && ` en ${refundMethod === 'cash' ? 'espèces' : 'Mobile Money'}`}
                </>
              )}
              .
            </p>
            <p className="text-xs text-neutral-400">
              {reason === 'change_of_mind' ? STATUS_AFTER.in_stock : option.action.endsWith('repair') ? STATUS_AFTER.in_repair : STATUS_AFTER.defective}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setConfirming(false)} className="h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-300 font-bold text-sm">
                Non
              </button>
              <button
                onClick={submit}
                disabled={createReturn.isPending}
                className="col-span-2 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-sm disabled:opacity-50"
              >
                {createReturn.isPending ? 'Enregistrement…' : 'Oui, valider'}
              </button>
            </div>
          </BlurFade>
        </div>
      )}
    </BlurFade>
  );
}

function ResultScreen({ result, data, currency, onNext }: { result: ProductReturn; data: ReturnLookup; currency: string; onNext: () => void }) {
  const hasCredit = !!result.creditNoteCode;
  return (
    <BlurFade className="max-w-xl mx-auto space-y-4">
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-4 print:border-black">
        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto print:hidden" />
        <div>
          <p className="text-2xl font-black text-white">Retour enregistré</p>
          <p className="text-xs text-neutral-400 mt-1">
            RET-{result.returnNumber} · {data.product?.name} · N° {result.serialNumber}
          </p>
        </div>

        {hasCredit && (
          <div className="rounded-2xl border border-gold/40 bg-neutral-950 p-5 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">{result.action === 'exchange' ? 'Avoir pour l’échange' : 'Avoir à remettre au client'}</p>
            <p className="text-4xl font-black tracking-widest text-gold-soft font-mono">{result.creditNoteCode}</p>
            <p className="text-lg font-bold text-white">{money(result.amount, currency)}</p>
          </div>
        )}
        {result.action === 'refund' && (
          <div className="rounded-2xl border border-gold/40 bg-neutral-950 p-5">
            <p className="text-sm text-neutral-300">Rendez au client</p>
            <p className="text-3xl font-black text-gold-soft">{money(result.amount, currency)}</p>
            <p className="text-xs text-neutral-400">en {result.refundMethod === 'mobile' ? 'Mobile Money' : 'espèces'} — déduit de votre caisse à la clôture</p>
          </div>
        )}
        {result.repairTicketNumber && (
          <p className="text-sm text-white flex items-center justify-center gap-2">
            <Wrench className="w-4 h-4 text-gold" /> Ticket atelier <strong>SAV-{result.repairTicketNumber}</strong>
          </p>
        )}
        <p className="text-xs text-neutral-400">{STATUS_AFTER[result.unitStatusAfter]}</p>

        <div className="grid grid-cols-2 gap-2 print:hidden">
          {result.action === 'exchange' ? (
            <Link
              href={`/app/scan?credit=${encodeURIComponent(result.creditNoteCode || '')}`}
              className="col-span-2 h-12 rounded-2xl bg-gold text-ink font-bold text-sm flex items-center justify-center gap-2"
            >
              <ScanLine className="w-4 h-4" /> Scanner le nouvel appareil
            </Link>
          ) : (
            <button onClick={onNext} className="h-12 rounded-2xl bg-gold text-ink font-bold text-sm flex items-center justify-center gap-2">
              <ScanLine className="w-4 h-4" /> Autre retour
            </button>
          )}
          {hasCredit && (
            <button onClick={() => window.print()} className="h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Imprimer l&apos;avoir
            </button>
          )}
          {result.repairTicketNumber && (
            <Link href="/app/repairs" className="h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
              <Wrench className="w-4 h-4" /> Voir l&apos;atelier
            </Link>
          )}
        </div>
      </div>
      {result.action !== 'exchange' && (
        <button onClick={onNext} className="w-full text-xs text-neutral-500 hover:text-white flex items-center justify-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à la liste
        </button>
      )}
    </BlurFade>
  );
}

function History({ currency }: { currency: string }) {
  const { data: list = [] } = useReturns(30);
  if (!list.length) return null;
  const label: Record<string, string> = {
    credit_note: 'Avoir',
    refund: 'Remboursement',
    exchange: 'Échange',
    warranty_repair: 'Réparation garantie',
    paid_repair: 'Réparation payante',
  };
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Derniers retours</p>
      {list.map((r) => (
        <div key={r._id} className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{r.productName}</p>
            <p className="text-[11px] text-neutral-500 font-mono truncate">
              RET-{r.returnNumber} · {r.serialNumber} · {dateTime(r.createdAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-gold-soft">{label[r.action]}</p>
            <p className="text-[11px] text-neutral-400">{r.creditNoteCode || (r.repairTicketNumber ? `SAV-${r.repairTicketNumber}` : r.amount ? money(r.amount, currency) : '')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-white font-semibold truncate">{value}</p>
    </div>
  );
}

function ReasonButton({ active, onClick, icon: Icon, label, sub }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 text-left transition-colors',
        active ? 'border-gold bg-gold/10' : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600'
      )}
    >
      <Icon className={cn('w-5 h-5 mb-2', active ? 'text-gold' : 'text-neutral-400')} />
      <p className="text-sm font-bold text-white">{label}</p>
      <p className="text-[11px] text-neutral-500">{sub}</p>
    </button>
  );
}
