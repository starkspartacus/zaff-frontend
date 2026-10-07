'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, FileSignature, Plus, RotateCcw, Settings, ShieldCheck, Trash2, Undo2, Wrench } from 'lucide-react';
import { ContractSettingsPanel } from '@/components/contract/contract-settings';
import { useReturnPolicy, useUpdateReturnPolicy } from '@/lib/queries';
import { errorMessage, type ActionToggles, type ReturnPolicy } from '@/lib/types';
import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';

type Tab = 'returns' | 'contract';
const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'returns', label: 'Retours et garantie', icon: ShieldCheck },
  { id: 'contract', label: 'Contrat client', icon: FileSignature },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('returns');
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-gold" /> Paramètres de la boutique
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          {tab === 'returns'
            ? 'Retours, avoirs et garantie : vos vendeurs ne proposeront que ce que vous autorisez ici.'
            : 'Le contrat de vente et de garantie remis au client après chaque vente.'}
        </p>
      </div>
      <div role="tablist" className="grid grid-cols-2 p-1 rounded-2xl bg-neutral-900 border border-neutral-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'relative h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
              tab === id ? 'text-ink' : 'text-neutral-400 hover:text-white'
            )}
          >
            {tab === id && <motion.span layoutId="settings-tab" className="absolute inset-0 -z-0 rounded-xl bg-gradient-to-r from-gold to-gold-soft" />}
            <Icon className="relative w-4 h-4" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
      {tab === 'returns' ? <ReturnPolicyTab /> : <ContractSettingsPanel />}
    </div>
  );
}

function ReturnPolicyTab() {
  const { data: saved, isLoading } = useReturnPolicy();
  if (isLoading || !saved) {
    return <div className="rounded-3xl border border-neutral-800 p-10 text-center text-sm text-neutral-500">Chargement des paramètres…</div>;
  }
  // Le formulaire part des valeurs enregistrées ; après « Enregistrer », `saved` suit et le message reste affiché
  return <ReturnPolicyForm saved={saved} />;
}

function ReturnPolicyForm({ saved }: { saved: ReturnPolicy }) {
  const update = useUpdateReturnPolicy();
  const [p, setP] = useState<ReturnPolicy>(saved);
  const [newCondition, setNewCondition] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);

  const set = <K extends keyof ReturnPolicy>(k: K, v: ReturnPolicy[K]) => {
    setP((prev) => ({ ...prev, [k]: v }));
    setMessage(null);
  };
  const setDef = <K extends keyof ReturnPolicy['defective']>(k: K, v: ReturnPolicy['defective'][K]) => {
    setP((prev) => ({ ...prev, defective: { ...prev.defective, [k]: v } }));
    setMessage(null);
  };

  const save = async () => {
    try {
      await update.mutateAsync(p);
      setMessage({ ok: true, text: 'Paramètres enregistrés : vos vendeurs appliquent désormais ces règles.' });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    }
  };

  const addCondition = () => {
    const c = newCondition.trim();
    if (!c || p.conditions.includes(c) || p.conditions.length >= 10) return;
    set('conditions', [...p.conditions, c]);
    setNewCondition('');
  };

  return (
    <div className="space-y-6 pb-24">

      <Summary p={p} />

      {/* Changement d'avis */}
      <Card icon={Undo2} title="Retour d'un appareil en bon état" subtitle="Le client a changé d'avis">
        <Toggle label="Accepter les retours pour changement d'avis" checked={p.returnsEnabled} onChange={(v) => set('returnsEnabled', v)} />
        {p.returnsEnabled && (
          <>
            <NumberField label="Délai de retour" suffix="jours après l'achat" value={p.returnWindowDays} min={0} max={90} onChange={(v) => set('returnWindowDays', v)} />
            <Actions label="Solutions proposées au client" value={p.changeOfMind} onChange={(v) => set('changeOfMind', v)} />
            <NumberField
              label="Frais de remise en stock"
              suffix="% retenus sur l'avoir ou le remboursement"
              value={p.restockingFeePercent}
              min={0}
              max={50}
              onChange={(v) => set('restockingFeePercent', v)}
            />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-300">Conditions que le vendeur doit vérifier</p>
              {p.conditions.map((c) => (
                <div key={c} className="flex items-center justify-between gap-2 rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-white">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {c}
                  </span>
                  <button
                    onClick={() => set('conditions', p.conditions.filter((x) => x !== c))}
                    className="p-1 text-neutral-500 hover:text-red-400"
                    aria-label={`Retirer ${c}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCondition())}
                  placeholder="Ex. : Facture d'achat présentée"
                  maxLength={120}
                  className="flex-1 h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold"
                />
                <button onClick={addCondition} className="h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Argent rendu */}
      <Card icon={RotateCcw} title="Avoirs et remboursements">
        <NumberField label="Validité d'un avoir" suffix="jours" value={p.creditNoteValidityDays} min={7} max={730} onChange={(v) => set('creditNoteValidityDays', v)} />
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-neutral-300">Modes de remboursement autorisés</p>
          <div className="flex gap-2">
            {(['cash', 'mobile'] as const).map((m) => {
              const on = p.refundMethods.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => set('refundMethods', on ? p.refundMethods.filter((x) => x !== m) : [...p.refundMethods, m])}
                  className={cn(
                    'px-4 h-10 rounded-xl border text-xs font-semibold',
                    on ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  )}
                >
                  {m === 'cash' ? 'Espèces' : 'Mobile Money'}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-500">Un remboursement est déduit de la caisse du vendeur à sa clôture.</p>
        </div>
      </Card>

      {/* Pannes */}
      <Card icon={Wrench} title="Appareil en panne" subtitle="Défaut constaté par le client">
        <NumberField
          label="Panne dans les premiers jours"
          suffix="jours : échange, avoir ou remboursement intégral (sans frais)"
          value={p.defective.exchangeWindowDays}
          min={0}
          max={90}
          onChange={(v) => setDef('exchangeWindowDays', v)}
        />
        {p.defective.exchangeWindowDays > 0 && (
          <Actions label="Solutions dans ce délai" value={p.defective.earlyActions} onChange={(v) => setDef('earlyActions', v)} />
        )}
        <p className="text-[11px] text-neutral-500">
          L&apos;appareil défectueux repris ne revient jamais en stock vendable : il part à l&apos;atelier et sera remis en vente après réparation.
        </p>
      </Card>

      <Card icon={ShieldCheck} title="Garantie">
        <NumberField
          label="Garantie par défaut"
          suffix="mois (si la vente n'en précise pas)"
          value={p.defective.defaultWarrantyMonths}
          min={0}
          max={60}
          onChange={(v) => setDef('defaultWarrantyMonths', v)}
        />
        <Toggle label="Réparation gratuite sous garantie" checked={p.defective.warrantyRepair} onChange={(v) => setDef('warrantyRepair', v)} />
        <Toggle label="Réparation payante (devis) hors garantie" checked={p.defective.paidRepairOutOfWarranty} onChange={(v) => setDef('paidRepairOutOfWarranty', v)} />
      </Card>

      {/* Barre d'enregistrement */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-72 z-30 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className={cn('text-xs', message ? (message.ok ? 'text-emerald-400' : 'text-red-400') : 'text-neutral-500')}>
            {message?.text || (dirty ? 'Modifications non enregistrées' : 'À jour')}
          </p>
          <div className="flex gap-2">
            {dirty && (
              <button onClick={() => setP(saved)} className="h-11 px-4 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 text-sm">
                Annuler
              </button>
            )}
            <button
              onClick={save}
              disabled={!dirty || update.isPending}
              className="h-11 px-5 rounded-xl bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-sm disabled:opacity-40"
            >
              {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ce que le client entendra au comptoir, en une phrase */
function Summary({ p }: { p: ReturnPolicy }) {
  const list = (t: ActionToggles) => [t.exchange && 'échange', t.creditNote && 'avoir', t.refund && 'remboursement'].filter(Boolean).join(', ') || 'aucune solution';
  return (
    <BlurFade className="rounded-3xl border border-gold/30 bg-gold/5 p-4 space-y-1.5 text-sm text-neutral-200">
      <p className="text-[11px] uppercase tracking-wider text-gold font-semibold">Ce que vos clients entendront</p>
      <p>
        {p.returnsEnabled
          ? `Retour accepté sous ${p.returnWindowDays} jours si l'appareil est en parfait état : ${list(p.changeOfMind)}${p.restockingFeePercent ? ` (frais de ${p.restockingFeePercent} %)` : ''}.`
          : "Pas de retour pour changement d'avis."}
      </p>
      <p>
        {p.defective.exchangeWindowDays > 0 ? `Panne dans les ${p.defective.exchangeWindowDays} premiers jours : ${list(p.defective.earlyActions)}. ` : ''}
        {p.defective.defaultWarrantyMonths > 0 && p.defective.warrantyRepair ? `Ensuite, réparation gratuite sous garantie (${p.defective.defaultWarrantyMonths} mois par défaut).` : ''}
        {p.defective.paidRepairOutOfWarranty ? ' Hors garantie : réparation sur devis.' : ''}
      </p>
    </BlurFade>
  );
}

function Card({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-neutral-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('relative w-11 h-6 rounded-full transition-colors shrink-0', checked ? 'bg-gold' : 'bg-neutral-700')}
      >
        <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

function NumberField({ label, suffix, value, min, max, onChange }: { label: string; suffix: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-neutral-300">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Math.round(Number(e.target.value) || 0))))}
          className="w-20 h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm font-bold text-white focus:outline-none focus:border-gold"
        />
        <span className="text-xs text-neutral-400">{suffix}</span>
      </span>
    </label>
  );
}

function Actions({ label, value, onChange }: { label: string; value: ActionToggles; onChange: (v: ActionToggles) => void }) {
  const items: Array<[keyof ActionToggles, string]> = [
    ['exchange', 'Échange'],
    ['creditNote', 'Avoir'],
    ['refund', 'Remboursement'],
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-neutral-300">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map(([k, l]) => (
          <button
            key={k}
            onClick={() => onChange({ ...value, [k]: !value[k] })}
            aria-pressed={value[k]}
            className={cn(
              'px-4 h-10 rounded-xl border text-xs font-semibold',
              value[k] ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
