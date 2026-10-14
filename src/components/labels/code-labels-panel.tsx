'use client';

import React, { useMemo, useState } from 'react';
import { History, Lock, Pencil, Plus, Printer, QrCode, Tag, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Input } from '@/components/ui/input';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useCodeBatch, useCodeBatches, useCodeSeries, useGenerateCodes, useMarkPrinted, useProducts, useSaveCodeSeries } from '@/lib/queries';
import { errorMessage, type CodeBatch, type CodeSeries } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LABEL_FORMATS, openPrintWindow, printLabels, type LabelFormat } from './print-labels';

const dateTime = (d: string | Date) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const inputCls = 'h-11 bg-neutral-900 border-neutral-800 text-white rounded-xl';
const STATUS_FR: Record<string, string> = { in_stock: 'En stock', sold: 'Vendu', defective: 'Défectueux', in_repair: 'En réparation', consigned: 'En dépôt' };

function Card({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-white flex items-center gap-2">
          <Icon className="w-4 h-4 text-gold" /> {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Codes appareils générés par la boutique : séries par catégorie, génération, impression, traçabilité */
export function CodeLabelsPanel() {
  const { user } = useAuth();
  const isOwner = user?.role === 'admin';
  const { data } = useCodeSeries();
  const series = data?.series || [];
  const [batch, setBatch] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 text-xs text-neutral-300 space-y-1">
        <p className="font-semibold text-white">Pour les appareils livrés sans N° de série ni code exploitable</p>
        <p>
          Générez des codes uniques (ex. <span className="font-mono text-gold-soft">TEL-00000125</span>), imprimez les étiquettes (QR code + code-barres),
          collez-en une sur chaque appareil puis scannez-la dans « Mise en stock » comme un N° de série. Le dernier chiffre est un contrôle : un code mal
          tapé est refusé.
        </p>
      </div>
      <SeriesCard series={series} suggestions={data?.suggestions || []} isOwner={isOwner} />
      {series.length > 0 && <GenerateCard series={series} onDone={setBatch} />}
      <HistoryCard onOpen={setBatch} />
      {batch && <BatchModal id={batch} onClose={() => setBatch(null)} />}
    </div>
  );
}

function SeriesCard({ series, suggestions, isOwner }: { series: CodeSeries[]; suggestions: Array<{ category: string; prefix: string }>; isOwner: boolean }) {
  const save = useSaveCodeSeries();
  const [editing, setEditing] = useState<{ id?: string; category: string; prefix: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (v: { id?: string; category: string; prefix: string }) => {
    setError(null);
    try {
      await save.mutateAsync(v);
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const remove = async (s: CodeSeries) => {
    if (!window.confirm(`Supprimer la série ${s.prefix} (${s.category}) ?`)) return;
    try {
      await save.mutateAsync({ id: s._id, remove: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Card
      title="Préfixe par catégorie"
      icon={Tag}
      action={
        isOwner && (
          <button onClick={() => setEditing({ category: '', prefix: '' })} className="h-8 px-3 rounded-lg bg-gold/15 text-gold text-xs font-semibold flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        )
      }
    >
      {series.length === 0 && <p className="text-xs text-neutral-500">Aucune série pour le moment.{!isOwner && ' Le propriétaire les crée dans Paramètres.'}</p>}
      {series.map((s) => (
        <div key={s._id} className="flex items-center gap-3 rounded-xl bg-neutral-900 px-3 py-2.5">
          <span className="px-2 py-1 rounded-lg bg-gold text-ink font-mono text-xs font-black">{s.prefix}-</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white capitalize truncate">{s.category}</p>
            <p className="text-[11px] text-neutral-500">
              {s.generatedCount} code(s) générés · {s.usedCount} sur des appareils
            </p>
          </div>
          {s.locked ? (
            <span title="Préfixe verrouillé : des codes ont été générés" className="text-neutral-500">
              <Lock className="w-4 h-4" />
            </span>
          ) : (
            isOwner && (
              <>
                <button onClick={() => setEditing({ id: s._id, category: s.category, prefix: s.prefix })} className="p-1.5 text-neutral-400" aria-label={`Modifier ${s.prefix}`}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(s)} className="p-1.5 text-red-400" aria-label={`Supprimer ${s.prefix}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )
          )}
        </div>
      ))}
      {isOwner && suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-neutral-500">Catégories de vos produits sans série — un clic pour créer :</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.category}
                onClick={() => setEditing({ category: s.category, prefix: s.prefix })}
                className="h-9 px-3 rounded-full border border-dashed border-gold/50 text-xs text-gold-soft capitalize"
              >
                {s.category} → <span className="font-mono font-bold">{s.prefix}-</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {editing && (
        <div className="rounded-xl border border-gold/40 p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Catégorie (ex : smartphones)" className={cn(inputCls, 'col-span-2')} />
            <Input
              value={editing.prefix}
              onChange={(e) => setEditing({ ...editing, prefix: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) })}
              placeholder="TEL"
              className={cn(inputCls, 'font-mono font-bold')}
              aria-label="Préfixe"
            />
          </div>
          <p className="text-[11px] text-neutral-500">
            2 à 5 lettres. Exemple de code : <span className="font-mono">{editing.prefix || 'TEL'}-00000017</span>. Le préfixe ne pourra plus changer après la première génération.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="flex-1 h-10 rounded-xl border border-neutral-700 text-neutral-300 text-sm">
              Annuler
            </button>
            <button onClick={() => submit(editing)} disabled={save.isPending} className="flex-1 h-10 rounded-xl bg-gold text-ink text-sm font-bold disabled:opacity-60">
              Enregistrer
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </Card>
  );
}

function GenerateCard({ series, onDone }: { series: CodeSeries[]; onDone: (id: string) => void }) {
  const { establishment } = useAuth();
  const { data: products = [] } = useProducts();
  const generate = useGenerateCodes();
  const printed = useMarkPrinted();
  const [seriesId, setSeriesId] = useState(series[0]?._id || '');
  const [count, setCount] = useState(10);
  const [productId, setProductId] = useState('');
  const [format, setFormat] = useState<LabelFormat>('thermal');
  const [error, setError] = useState<string | null>(null);
  const current = series.find((s) => s._id === seriesId) || series[0];
  const models = useMemo(
    () => products.filter((p) => p.hasSerialNumbers && (!current || (p.category || '').toLowerCase() === current.category.toLowerCase())),
    [products, current],
  );

  const run = async () => {
    setError(null);
    if (!current) return;
    let win: Window | undefined;
    try {
      win = openPrintWindow();
      const b = await generate.mutateAsync({ seriesId: current._id, count, productId: productId || undefined });
      await printLabels({ codes: b.codes || [], format, shop: establishment?.name || '', productName: b.productName, category: b.category }, win);
      printed.mutate({ id: b._id, format });
      onDone(b._id);
    } catch (e) {
      win?.close();
      setError(errorMessage(e));
    }
  };

  return (
    <Card title="Générer des étiquettes" icon={QrCode}>
      <div className="flex flex-wrap gap-2">
        {series.map((s) => (
          <button
            key={s._id}
            onClick={() => (setSeriesId(s._id), setProductId(''))}
            className={cn('h-9 px-3 rounded-full border text-xs font-semibold capitalize', current?._id === s._id ? 'border-gold bg-gold/10 text-gold-soft' : 'border-neutral-800 text-neutral-400')}
          >
            <span className="font-mono">{s.prefix}-</span> {s.category}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Nombre d&apos;étiquettes</label>
        <div className="flex flex-wrap gap-2">
          {[1, 5, 10, 20, 50].map((n) => (
            <button key={n} onClick={() => setCount(n)} className={cn('h-10 w-12 rounded-xl border text-sm font-bold', count === n ? 'border-gold bg-gold/10 text-gold-soft' : 'border-neutral-800 text-neutral-300')}>
              {n}
            </button>
          ))}
          <Input
            inputMode="numeric"
            value={String(count)}
            onChange={(e) => setCount(Math.min(500, Math.max(1, parseInt(e.target.value.replace(/\D/g, '') || '1', 10))))}
            className={cn(inputCls, 'w-20 h-10 text-center')}
            aria-label="Nombre d'étiquettes"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Modèle prévu (imprimé sur l&apos;étiquette, facultatif)</label>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={cn(inputCls, 'w-full px-3 border')}>
          <option value="">— Aucun —</option>
          {models.map((p) => (
            <option key={p._id} value={p._id}>
              {[p.name, p.model].filter(Boolean).join(' ')}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(LABEL_FORMATS) as LabelFormat[]).map((f) => (
          <button key={f} onClick={() => setFormat(f)} className={cn('rounded-xl border p-3 text-left', format === f ? 'border-gold bg-gold/10' : 'border-neutral-800')}>
            <span className="block text-xs font-semibold text-white">{LABEL_FORMATS[f].label}</span>
            <span className="block text-[11px] text-neutral-500">{LABEL_FORMATS[f].hint}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={run} disabled={generate.isPending || !current} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold flex items-center justify-center gap-2 disabled:opacity-60">
        <Printer className="w-4 h-4" /> {generate.isPending ? 'Génération…' : `Générer ${count} code(s) ${current?.prefix || ''}- et imprimer`}
      </button>
    </Card>
  );
}

function HistoryCard({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: batches = [] } = useCodeBatches();
  return (
    <Card title="Historique des générations" icon={History}>
      {batches.length === 0 ? (
        <p className="text-xs text-neutral-500">Aucun code généré pour le moment.</p>
      ) : (
        batches.map((b: CodeBatch) => (
          <button key={b._id} onClick={() => onOpen(b._id)} className="w-full text-left rounded-xl bg-neutral-900 px-3 py-2.5 flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm text-white">
                {b.code} · <span className="font-mono">{b.prefix}-</span> × {b.count}
                {b.productName ? ` · ${b.productName}` : ''}
              </span>
              <span className="block text-[11px] text-neutral-500">
                {dateTime(b.createdAt)} par {b.createdByName || '—'} · imprimé {b.printCount} fois
              </span>
            </span>
            <span className={cn('text-[11px] font-semibold shrink-0', b.usedCount >= b.count ? 'text-emerald-400' : 'text-neutral-400')}>
              {b.usedCount}/{b.count} utilisés
            </span>
          </button>
        ))
      )}
    </Card>
  );
}

function BatchModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { establishment } = useAuth();
  const { data: b } = useCodeBatch(id);
  const printed = useMarkPrinted();
  const [format, setFormat] = useState<LabelFormat>('thermal');
  const [error, setError] = useState<string | null>(null);
  const free = (b?.items || []).filter((i) => !i.used).map((i) => i.code);

  const print = async (codes: string[]) => {
    if (!b || !codes.length) return;
    setError(null);
    try {
      await printLabels({ codes, format, shop: establishment?.name || '', productName: b.productName, category: b.category });
      printed.mutate({ id: b._id, format, count: codes.length });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <BlurFade className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{b ? `${b.code} · ${b.count} code(s) ${b.prefix}-` : 'Chargement…'}</h2>
            {b && (
              <p className="text-[11px] text-neutral-500">
                Généré le {dateTime(b.createdAt)} par {b.createdByName || '—'}
                {b.productName ? ` · ${b.productName}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {b && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(LABEL_FORMATS) as LabelFormat[]).map((f) => (
                <button key={f} onClick={() => setFormat(f)} className={cn('rounded-xl border px-3 py-2 text-left text-xs', format === f ? 'border-gold bg-gold/10 text-white' : 'border-neutral-800 text-neutral-400')}>
                  {LABEL_FORMATS[f].label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => print(free)} disabled={!free.length} className="h-11 rounded-xl bg-gold text-ink text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
                <Printer className="w-4 h-4" /> Réimprimer les {free.length} libres
              </button>
              <button onClick={() => print(b.items?.map((i) => i.code) || [])} className="h-11 rounded-xl border border-neutral-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                <Printer className="w-4 h-4" /> Tout réimprimer
              </button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="space-y-1">
              {(b.items || []).map((i) => (
                <div key={i.code} className="flex items-center justify-between gap-2 text-xs rounded-lg bg-neutral-900 px-3 py-2">
                  <span className="font-mono text-white">{i.code}</span>
                  <span className={i.used ? 'text-emerald-400' : 'text-neutral-500'}>{i.used ? `${STATUS_FR[i.status || ''] || i.status} · ${i.productName || ''}` : 'Libre'}</span>
                </div>
              ))}
            </div>
            {(b.prints || []).length > 0 && (
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-neutral-400">Impressions</p>
                {(b.prints || []).map((p, k) => (
                  <p key={k} className="text-[11px] text-neutral-500">
                    {dateTime(p.at)} · {p.byName} · {p.count} étiquette(s) · {p.format === 'a4' ? 'A4' : 'thermique'}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </BlurFade>
    </div>
  );
}
