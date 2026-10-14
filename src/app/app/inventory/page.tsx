'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Ban, Check, ClipboardCheck, HelpCircle, Minus, Package, Play, Plus, Printer, ScanLine, Users, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useCurrentStockCount, useProducts, useStockCount, useStockCountAction, useStockCountScan, useStockCounts } from '@/lib/queries';
import { errorMessage, type StockCount, type StockCountReport, type StockCountScan } from '@/lib/types';
import { cn } from '@/lib/utils';

const money = (n: number, currency: string) => `${Math.round(n || 0).toLocaleString('fr-FR')} ${currency}`;
const dateTime = (d: string | Date) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

type Tone = 'ok' | 'warn' | 'bad';
const toneOf = (s: StockCountScan): Tone =>
  s.result === 'found' || s.result === 'counted' ? 'ok' : s.result === 'unexpected' || s.kind === 'unknown' ? 'bad' : 'warn';
const TONE: Record<Tone, string> = {
  ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  bad: 'border-red-500/40 bg-red-500/10 text-red-400',
};

export default function InventoryPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'storekeeper';
  const { data: current, isLoading } = useCurrentStockCount();
  const { data: history = [] } = useStockCounts(canManage);
  const [viewing, setViewing] = useState<string | null>(null);
  const [justClosed, setJustClosed] = useState<StockCount | null>(null);

  if (justClosed?.report) {
    return <ReportView count={justClosed} onBack={() => setJustClosed(null)} />;
  }
  if (viewing) return <HistoryReport id={viewing} onBack={() => setViewing(null)} />;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-gold" /> Inventaire par scan
        </h1>
        <p className="text-sm text-neutral-400">Scannez chaque appareil présent en boutique : ZAFF trouve ce qui manque et ce qui ne devrait pas être là.</p>
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-neutral-500 py-8">Chargement…</p>
      ) : current ? (
        <CountSession count={current} canManage={canManage} onClosed={setJustClosed} />
      ) : canManage ? (
        <StartPanel />
      ) : (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center space-y-2">
          <ClipboardCheck className="w-10 h-10 text-neutral-700 mx-auto" />
          <p className="text-sm text-neutral-400">Aucun inventaire en cours. Le propriétaire ou le magasinier le démarre ; vous pourrez alors aider à scanner.</p>
        </div>
      )}

      {canManage && history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Inventaires précédents</p>
          {history.map((h) => (
            <button key={h._id} onClick={() => h.report && setViewing(h._id)} className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {h.code} · {h.category || 'Tout le stock'}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {dateTime(h.startedAt)}
                  {h.closedByName ? ` · terminé par ${h.closedByName}` : ''}
                </p>
              </div>
              {h.status === 'cancelled' ? (
                <span className="text-[11px] text-neutral-500">Annulé</span>
              ) : h.report && h.report.missing.length ? (
                <span className="text-[11px] font-semibold text-red-400">{h.report.missing.length} manquant(s)</span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-400">Tout est là</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StartPanel() {
  const { data: products = [] } = useProducts();
  const action = useStockCountAction();
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean) as string[])].sort(), [products]);

  const start = async () => {
    setError(null);
    try {
      await action.mutateAsync({ kind: 'start', category });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <BlurFade className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5 space-y-4">
      <div className="space-y-1">
        <p className="text-base font-bold text-white">Démarrer un inventaire</p>
        <p className="text-xs text-neutral-400">Toute l&apos;équipe peut scanner en même temps depuis son téléphone. Les ventes continuent pendant le comptage.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {['', ...categories].map((c) => (
          <button
            key={c || 'all'}
            onClick={() => setCategory(c)}
            className={cn('h-9 px-3 rounded-full border text-xs font-semibold capitalize', category === c ? 'border-gold bg-gold/10 text-gold-soft' : 'border-neutral-800 text-neutral-400')}
          >
            {c || 'Tout le stock'}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={start} disabled={action.isPending} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold flex items-center justify-center gap-2 disabled:opacity-60">
        <Play className="w-4 h-4" /> {action.isPending ? 'Démarrage…' : 'Commencer le comptage'}
      </button>
    </BlurFade>
  );
}

function CountSession({ count, canManage, onClosed }: { count: StockCount; canManage: boolean; onClosed: (c: StockCount) => void }) {
  const scan = useStockCountScan();
  const action = useStockCountAction();
  const [log, setLog] = useState<StockCountScan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [apply, setApply] = useState(true);
  const p = count.progress!;
  const pct = p.expectedUnits ? Math.round((p.foundUnits / p.expectedUnits) * 100) : 100;

  const onScan = async (code: string) => {
    setError(null);
    try {
      const r = await scan.mutateAsync({ id: count._id, code });
      scanFeedback(toneOf(r) === 'ok');
      setLog((l) => [r, ...l].slice(0, 12));
    } catch (e) {
      scanFeedback(false);
      setError(errorMessage(e));
    }
  };

  const adjust = async (productId: string, qty: number) => {
    if (!qty) return;
    setError(null);
    try {
      await scan.mutateAsync({ id: count._id, productId, qty });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const close = async () => {
    setError(null);
    try {
      const c = await action.mutateAsync({ kind: 'close', id: count._id, applyAdjustments: apply });
      setConfirming(false);
      onClosed(c);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const cancel = async () => {
    if (!window.confirm('Annuler cet inventaire ? Les scans seront perdus et le stock ne changera pas.')) return;
    try {
      await action.mutateAsync({ kind: 'cancel', id: count._id });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const last = log[0];
  const notCounted = p.plain.filter((x) => x.counted === null).length;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-gold/40 bg-neutral-950 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">
              {count.code} · {count.category || 'Tout le stock'}
            </p>
            <p className="text-[11px] text-neutral-500">
              Commencé {dateTime(count.startedAt)} par {count.startedByName || '—'}
            </p>
          </div>
          {count.scannedBy.length > 0 && (
            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {count.scannedBy.join(', ')}
            </span>
          )}
        </div>
        <div>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-white">
              {p.foundUnits}
              <span className="text-base text-neutral-500"> / {p.expectedUnits} appareils</span>
            </p>
            <p className="text-sm font-bold text-gold-soft">{pct} %</p>
          </div>
          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden mt-2">
            <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <BarcodeScanner onScan={onScan} placeholder="Scannez le N° de série / IMEI, ou le code-barres d'un accessoire" />

      {last && (
        <BlurFade key={`${last.serialNumber}-${log.length}`} className={cn('rounded-2xl border p-4 flex items-start gap-3', TONE[toneOf(last)])}>
          {toneOf(last) === 'ok' ? <Check className="w-6 h-6 shrink-0" /> : toneOf(last) === 'bad' ? <AlertTriangle className="w-6 h-6 shrink-0" /> : <HelpCircle className="w-6 h-6 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{last.productName || last.serialNumber || 'Code scanné'}</p>
            {last.serialNumber && last.productName && <p className="text-[11px] font-mono text-neutral-400">{last.serialNumber}</p>}
            <p className="text-xs">{last.message}</p>
          </div>
        </BlurFade>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {log.length > 1 && (
        <div className="space-y-1">
          {log.slice(1).map((l, i) => (
            <p key={i} className="text-[11px] text-neutral-500 flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', toneOf(l) === 'ok' ? 'bg-emerald-400' : toneOf(l) === 'bad' ? 'bg-red-400' : 'bg-amber-400')} />
              <span className="font-mono">{l.serialNumber || ''}</span> {l.productName} — {l.message}
            </p>
          ))}
        </div>
      )}

      {p.byProduct.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5" /> Appareils (N° de série)
          </p>
          {p.byProduct.map((b) => (
            <div key={b.productId} className="flex items-center justify-between text-xs">
              <span className="text-neutral-200 truncate">{b.productName}</span>
              <span className={cn('font-mono shrink-0', b.found >= b.expected ? 'text-emerald-400' : 'text-neutral-400')}>
                {b.found}/{b.expected}
              </span>
            </div>
          ))}
        </div>
      )}

      {p.plain.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Accessoires (comptés à la quantité)
          </p>
          <p className="text-[11px] text-neutral-500">Scannez le code-barres (+1 à chaque scan) ou ajustez à la main.</p>
          {p.plain.map((x) => (
            <PlainRow key={x.productId} name={x.productName} expected={x.expected} counted={x.counted} showExpected={canManage} onAdjust={(d) => adjust(x.productId, d)} />
          ))}
        </div>
      )}

      {canManage && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={cancel} className="h-12 rounded-2xl border border-neutral-800 text-neutral-400 text-sm font-semibold flex items-center justify-center gap-1.5">
            <Ban className="w-4 h-4" /> Annuler
          </button>
          <button onClick={() => setConfirming(true)} className="col-span-2 h-12 rounded-2xl bg-gold text-ink text-sm font-bold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Terminer l&apos;inventaire
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full sm:max-w-md bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Terminer l&apos;inventaire ?</h2>
              <button onClick={() => setConfirming(false)} className="p-1.5 text-neutral-400" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 text-sm text-neutral-300">
              <p>
                {p.foundUnits} appareil(s) trouvé(s) sur {p.expectedUnits}.
              </p>
              {p.expectedUnits - p.foundUnits > 0 && <p className="text-red-400 font-semibold">{p.expectedUnits - p.foundUnits} appareil(s) pas encore scanné(s) : ils seront signalés manquants.</p>}
              {notCounted > 0 && <p className="text-amber-400">{notCounted} accessoire(s) non compté(s) : leur stock ne changera pas.</p>}
            </div>
            {p.plain.length > 0 && (
              <label className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3 cursor-pointer">
                <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} className="mt-1 accent-[var(--color-gold,#d4a017)]" />
                <span className="text-xs text-neutral-300">
                  <strong className="text-white block">Corriger le stock des accessoires comptés</strong>
                  Le stock prend la quantité comptée ; les ventes faites pendant l&apos;inventaire restent déduites.
                </span>
              </label>
            )}
            <p className="text-[11px] text-neutral-500">Les appareils manquants ne sont pas retirés du stock automatiquement : vérifiez-les d&apos;abord.</p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={close} disabled={action.isPending} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold disabled:opacity-60">
              {action.isPending ? 'Calcul du rapport…' : 'Terminer et voir le rapport'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlainRow({ name, expected, counted, showExpected, onAdjust }: { name: string; expected: number; counted: number | null; showExpected: boolean; onAdjust: (delta: number) => void }) {
  const [typed, setTyped] = useState('');
  const n = counted ?? 0;
  const setTo = () => {
    const v = parseInt(typed.replace(/\D/g, ''), 10);
    if (!Number.isNaN(v)) onAdjust(v - n);
    setTyped('');
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-neutral-200 truncate">{name}</p>
        <p className="text-[11px] text-neutral-500">
          {counted === null ? 'Pas encore compté' : `${counted} compté(s)`}
          {showExpected ? ` · attendu ${expected}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onAdjust(-1)} disabled={n <= 0} className="w-8 h-8 rounded-lg border border-neutral-700 text-neutral-300 flex items-center justify-center disabled:opacity-30" aria-label={`Moins ${name}`}>
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          inputMode="numeric"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => typed && setTo()}
          onKeyDown={(e) => e.key === 'Enter' && setTo()}
          placeholder={String(n)}
          className="w-12 h-8 rounded-lg border border-neutral-700 bg-transparent text-center text-white text-xs"
          aria-label={`Quantité comptée ${name}`}
        />
        <button onClick={() => onAdjust(1)} className="w-8 h-8 rounded-lg border border-neutral-700 text-neutral-300 flex items-center justify-center" aria-label={`Plus ${name}`}>
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function HistoryReport({ id, onBack }: { id: string; onBack: () => void }) {
  const { data } = useStockCount(id);
  if (!data?.report) return <p className="text-center text-sm text-neutral-500 py-8">Chargement…</p>;
  return <ReportView count={data} onBack={onBack} />;
}

function printReport(c: StockCount, r: StockCountReport, shop: string, currency: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  const rows = (list: string[][]) => list.map((cells) => `<tr>${cells.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('');
  const w = window.open('', '_blank', 'width=760,height=900');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${c.code}</title>
<style>body{font-family:system-ui,sans-serif;padding:28px;color:#111}table{width:100%;border-collapse:collapse;margin:8px 0 20px}td{border-bottom:1px solid #ddd;padding:6px;font-size:13px}h2{font-size:16px;margin-top:20px}</style></head><body>
<h1>Inventaire ${c.code}</h1><div>${esc(shop)} · ${esc(c.category || 'Tout le stock')} · ${dateTime(c.startedAt)} → ${c.closedAt ? dateTime(c.closedAt) : ''}</div>
<p><b>${r.foundUnits} / ${r.expectedUnits}</b> appareils trouvés · ${r.missing.length} manquant(s) (${money(r.missingValue, currency)})</p>
${r.missing.length ? `<h2>Manquants</h2><table>${rows(r.missing.map((m) => [m.productName, m.serialNumber, money(m.value, currency)]))}</table>` : ''}
${r.unexpected.length ? `<h2>Inattendus</h2><table>${rows(r.unexpected.map((u) => [u.productName, u.serialNumber, u.reason]))}</table>` : ''}
${r.unknownCodes.length ? `<h2>Codes inconnus</h2><table>${rows(r.unknownCodes.map((u) => [u]))}</table>` : ''}
${r.plain.length ? `<h2>Accessoires</h2><table>${rows(r.plain.map((x) => [x.productName, `attendu ${x.expected}`, x.counted === null ? 'non compté' : `compté ${x.counted}`, x.difference ? `${x.difference > 0 ? '+' : ''}${x.difference}${x.applied ? ' (corrigé)' : ''}` : '']))}</table>` : ''}
<p style="margin-top:40px">Signature :</p></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function ReportView({ count, onBack }: { count: StockCount; onBack: () => void }) {
  const { establishment } = useAuth();
  const currency = establishment?.currency || 'F CFA';
  const r = count.report!;
  const anomalies = r.unexpected.filter((u) => !u.duringCount);
  const diffs = r.plain.filter((x) => x.difference);

  return (
    <BlurFade className="max-w-3xl mx-auto space-y-4">
      <div className={cn('rounded-3xl border p-5 text-center space-y-2', r.missing.length ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5')}>
        {r.missing.length ? <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" /> : <Check className="w-12 h-12 text-emerald-400 mx-auto" />}
        <p className="text-xl font-black text-white">
          {count.code} · {r.missing.length ? `${r.missing.length} appareil(s) manquant(s)` : 'Tout est là'}
        </p>
        <p className="text-sm text-neutral-400">
          {r.foundUnits} / {r.expectedUnits} appareils trouvés
          {r.missing.length ? ` · valeur manquante ${money(r.missingValue, currency)}` : ''}
          {r.adjustedProducts ? ` · ${r.adjustedProducts} accessoire(s) corrigé(s)` : ''}
        </p>
      </div>

      {r.missing.length > 0 && (
        <Section title="Manquants : enregistrés en stock mais pas scannés" tone="bad">
          {r.missing.map((m) => (
            <Row key={m.unitId} left={m.productName} sub={m.serialNumber} right={money(m.value, currency)} />
          ))}
          <p className="text-[11px] text-neutral-500 pt-1">Cherchez-les (vitrine, réserve, chez un vendeur). S&apos;ils sont perdus, passez-les en « défectueux » dans Numéros de série.</p>
        </Section>
      )}
      {anomalies.length > 0 && (
        <Section title="Inattendus : scannés mais pas censés être en boutique" tone="bad">
          {anomalies.map((u) => (
            <Row key={u.serialNumber} left={u.productName} sub={u.serialNumber} right={u.reason} />
          ))}
        </Section>
      )}
      {r.unknownCodes.length > 0 && (
        <Section title="Codes inconnus (appareils jamais enregistrés)" tone="warn">
          {r.unknownCodes.map((c) => (
            <Row key={c} left={c} />
          ))}
          <p className="text-[11px] text-neutral-500 pt-1">Mettez-les en stock depuis « Mise en stock (scan) » si ce sont bien vos appareils.</p>
        </Section>
      )}
      {r.unexpected.some((u) => u.duringCount) && (
        <Section title="Vendus pendant l'inventaire (normal)" tone="ok">
          {r.unexpected.filter((u) => u.duringCount).map((u) => (
            <Row key={u.serialNumber} left={u.productName} sub={u.serialNumber} />
          ))}
        </Section>
      )}
      {r.plain.length > 0 && (
        <Section title="Accessoires" tone={diffs.length ? 'warn' : 'ok'}>
          {r.plain.map((x) => (
            <Row
              key={x.productId}
              left={x.productName}
              sub={x.counted === null ? 'Non compté : stock inchangé' : `Attendu ${x.expected} · compté ${x.counted}`}
              right={x.difference ? `${x.difference > 0 ? '+' : ''}${x.difference}${x.applied ? ' · corrigé' : ''}` : x.counted === null ? '' : 'OK'}
            />
          ))}
        </Section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => printReport(count, r, establishment?.name || '', currency)} className="h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
          <Printer className="w-4 h-4" /> Imprimer
        </button>
        <button onClick={onBack} className="h-12 rounded-2xl bg-gold text-ink text-sm font-bold">
          Retour
        </button>
      </div>
    </BlurFade>
  );
}

function Section({ title, tone, children }: { title: string; tone: Tone; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
      <p className={cn('text-xs font-semibold', tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-emerald-400')}>{title}</p>
      {children}
    </div>
  );
}

function Row({ left, sub, right }: { left: string; sub?: string; right?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="min-w-0">
        <span className="block text-neutral-200 truncate">{left}</span>
        {sub && <span className="block text-[11px] font-mono text-neutral-500">{sub}</span>}
      </span>
      {right && <span className="text-right text-neutral-400 shrink-0 max-w-[50%]">{right}</span>}
    </div>
  );
}
