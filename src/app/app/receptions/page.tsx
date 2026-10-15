'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, History, PackagePlus, Printer, Truck, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useReception, useReceptions } from '@/lib/queries';
import type { StockReception, StockReceptionLine } from '@/lib/types';
import { cn } from '@/lib/utils';

const money = (n: number, currency: string) => `${Math.round(n || 0).toLocaleString('fr-FR')} ${currency}`;
const dateTime = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dayKey = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Lignes regroupées par catégorie (l'ordre de la réception est déjà catégorie → modèle) */
function byCategory(lines: StockReceptionLine[]) {
  const m = new Map<string, StockReceptionLine[]>();
  for (const l of lines) m.set(l.categoryName, [...(m.get(l.categoryName) || []), l]);
  return [...m.entries()].sort((a, b) => b[1].reduce((x, l) => x + l.quantity, 0) - a[1].reduce((x, l) => x + l.quantity, 0));
}

export default function ReceptionsPage() {
  const { user, establishment } = useAuth();
  const isOwner = user?.role === 'admin';
  const currency = establishment?.currency || 'F CFA';
  const { data: list = [], isLoading } = useReceptions();
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('30');
  const [open, setOpen] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    if (period === 'all') return list;
    const since = now - Number(period) * 86400000;
    return list.filter((r) => new Date(r.createdAt).getTime() >= since);
  }, [list, period, now]);

  const totals = useMemo(() => {
    const cats = new Map<string, number>();
    filtered.forEach((r) => r.byCategory.forEach((c) => cats.set(c.categoryName, (cats.get(c.categoryName) || 0) + c.quantity)));
    return {
      units: filtered.reduce((a, r) => a + r.totalUnits, 0),
      value: filtered.reduce((a, r) => a + r.totalValue, 0),
      cats: [...cats.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [filtered]);

  const days = useMemo(() => {
    const m = new Map<string, StockReception[]>();
    filtered.forEach((r) => m.set(dayKey(r.createdAt), [...(m.get(dayKey(r.createdAt)) || []), r]));
    return [...m.entries()];
  }, [filtered]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="w-6 h-6 text-gold" /> Réceptions de marchandise
          </h1>
          <p className="text-sm text-neutral-400">Chaque ravitaillement : qui, quand, combien, par catégorie et par modèle.</p>
        </div>
        <Link href="/app/receive" className="h-11 px-4 rounded-2xl bg-gold text-ink text-sm font-bold flex items-center gap-2 shrink-0">
          <PackagePlus className="w-4 h-4" /> Réceptionner
        </Link>
      </div>

      <div className="flex gap-2">
        {([
          ['7', '7 jours'],
          ['30', '30 jours'],
          ['all', 'Tout'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setPeriod(id)} className={cn('h-9 px-3 rounded-full border text-xs font-semibold', period === id ? 'border-gold bg-gold/10 text-gold-soft' : 'border-neutral-800 text-neutral-400')}>
            {label}
          </button>
        ))}
      </div>

      <div className={cn('grid gap-2', isOwner ? 'grid-cols-3' : 'grid-cols-2')}>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3">
          <p className="text-[11px] text-neutral-500">Réceptions</p>
          <p className="text-xl font-black text-white">{filtered.length}</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3">
          <p className="text-[11px] text-neutral-500">Articles reçus</p>
          <p className="text-xl font-black text-white">{totals.units}</p>
        </div>
        {isOwner && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3">
            <p className="text-[11px] text-neutral-500">Valeur d&apos;achat</p>
            <p className="text-xl font-black text-gold-soft">{money(totals.value, currency)}</p>
          </div>
        )}
      </div>
      {totals.cats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totals.cats.map(([name, n]) => (
            <span key={name} className="px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-200">
              {name} <strong className="text-white">{n}</strong>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-sm text-neutral-500 py-8">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 py-8">Aucune réception sur la période.</p>
      ) : (
        days.map(([day, recs]) => (
          <div key={day} className="space-y-2">
            <p className="text-xs font-semibold text-neutral-400 capitalize">{day}</p>
            {recs.map((r) => (
              <button key={r._id} onClick={() => setOpen(r._id)} className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    {r.source === 'purchase_order' && <Truck className="w-4 h-4 text-gold" />}
                    {r.code}
                    <span className="font-normal text-neutral-400">
                      · {new Date(r.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {r.receivedByName || '—'}
                    </span>
                  </p>
                  <p className="text-lg font-black text-gold-soft shrink-0">{r.totalUnits}</p>
                </div>
                <p className="text-[11px] text-neutral-400">
                  {r.byCategory.map((c) => `${c.categoryName} ${c.quantity}`).join(' · ')}
                  {r.orderCode ? ` · commande ${r.orderCode}` : ''}
                  {r.supplierName ? ` · ${r.supplierName}` : ''}
                </p>
              </button>
            ))}
          </div>
        ))
      )}

      {open && <ReceptionModal id={open} isOwner={isOwner} currency={currency} shop={establishment?.name || ''} onClose={() => setOpen(null)} />}
    </div>
  );
}

function printReception(r: StockReception, shop: string, currency: string, withValue: boolean) {
  const w = window.open('', '_blank', 'width=780,height=900');
  if (!w) return;
  const blocks = byCategory(r.lines || [])
    .map(
      ([cat, lines]) => `<h2>${esc(cat)} — ${lines.reduce((a, l) => a + l.quantity, 0)}</h2><table>${lines
        .map(
          (l) =>
            `<tr><td><b>${esc(l.productName)}</b><br><span class="sn">${l.serialNumbers.map(esc).join(', ')}</span></td><td class="q">× ${l.quantity}</td>${withValue ? `<td class="q">${money(l.quantity * l.unitCost, currency)}</td>` : ''}</tr>`,
        )
        .join('')}</table>`,
    )
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${r.code}</title>
<style>body{font-family:system-ui,sans-serif;padding:28px;color:#111}h2{font-size:15px;margin:18px 0 4px}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:6px;font-size:13px;vertical-align:top}.q{text-align:right;white-space:nowrap}.sn{font-family:monospace;font-size:11px;color:#555}</style></head><body>
<h1>Réception ${r.code}</h1><div>${esc(shop)} · ${dateTime(r.createdAt)} · par ${esc(r.receivedByName || '—')}${r.orderCode ? ` · commande ${esc(r.orderCode)}` : ''}${r.supplierName ? ` · ${esc(r.supplierName)}` : ''}</div>
<p><b>${r.totalUnits} article(s)</b>${withValue ? ` · valeur d'achat ${money(r.totalValue, currency)}` : ''}</p>${blocks}
<p style="margin-top:40px">Signature :</p></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function ReceptionModal({ id, isOwner, currency, shop, onClose }: { id: string; isOwner: boolean; currency: string; shop: string; onClose: () => void }) {
  const { data: r } = useReception(id);
  const [openLine, setOpenLine] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <BlurFade className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{r ? `Réception ${r.code}` : 'Chargement…'}</h2>
            {r && (
              <p className="text-[11px] text-neutral-500">
                {dateTime(r.createdAt)} · {r.receivedByName}
                {r.orderCode ? ` · commande ${r.orderCode}` : ''}
                {r.supplierName ? ` · ${r.supplierName}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {r && (
          <>
            <div className="flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3">
              <span className="text-sm text-neutral-300">{r.totalUnits} article(s)</span>
              {isOwner && <span className="text-sm font-bold text-gold-soft">{money(r.totalValue, currency)}</span>}
            </div>
            {byCategory(r.lines || []).map(([cat, lines]) => (
              <div key={cat} className="space-y-1.5">
                <p className="text-xs font-semibold text-neutral-300 flex justify-between">
                  <span>{cat}</span>
                  <span>{lines.reduce((a, l) => a + l.quantity, 0)}</span>
                </p>
                {lines.map((l) => (
                  <div key={l.productId} className="rounded-xl bg-neutral-900">
                    <button onClick={() => setOpenLine(openLine === l.productId ? null : l.productId)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
                      <span className="text-sm text-white truncate">{l.productName}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-gold-soft">× {l.quantity}</span>
                        {l.serialNumbers.length > 0 && <ChevronDown className={cn('w-4 h-4 text-neutral-500 transition-transform', openLine === l.productId && 'rotate-180')} />}
                      </span>
                    </button>
                    {openLine === l.productId && (
                      <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                        {l.serialNumbers.map((sn) => (
                          <span key={sn} className="font-mono text-[11px] px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200">
                            {sn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {(r.rejected || []).length > 0 && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-1">
                <p className="text-xs font-semibold text-red-400">Refusés lors de cette réception</p>
                {r.rejected!.map((x) => (
                  <p key={x.serialNumber} className="text-[11px] text-neutral-300">
                    <span className="font-mono">{x.serialNumber}</span> ({x.productName}) — {x.reason}
                  </p>
                ))}
              </div>
            )}
            {r.note && <p className="text-xs text-neutral-400">Note : {r.note}</p>}
            <button onClick={() => printReception(r, shop, currency, isOwner)} className="w-full h-11 rounded-xl border border-neutral-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Imprimer le bon de réception
            </button>
          </>
        )}
      </BlurFade>
    </div>
  );
}
