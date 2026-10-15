'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, ClipboardList, Loader2, PackagePlus, Plus, Search, Trash2, X } from 'lucide-react';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { ProductForm } from '@/components/products/product-form';
import { ProductVisual } from '@/components/products/product-visual';
import { BlurFade } from '@/components/magicui/blur-fade';
import { api } from '@/lib/api';
import { imeiCheck } from '@/lib/imei';
import { useAddUnits, useProducts } from '@/lib/queries';
import { errorMessage, type Product, type ScanLookup } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Mise en stock « en rafale » :
 * - un seul champ de scan, toujours ouvert ; le modèle en cours reste choisi d'un scan à l'autre ;
 * - code-barres de la BOÎTE → change le modèle en cours (n'ajoute rien) ;
 * - N° de série / IMEI → une carte « appareil » dans le panier, sous le modèle en cours (vérifiée tout de suite) ;
 * - chaque carte se retire, un groupe peut changer de modèle ; rien n'est en stock avant « Enregistrer » ;
 * - le panier survit à un rechargement de la page (brouillon sur l'appareil).
 */

type ItemState = 'checking' | 'ready' | 'conflict' | 'saving' | 'saved' | 'rejected';
interface Item {
  serial: string;
  productId: string;
  state: ItemState;
  note?: string;
  at: number;
}

const DRAFT_KEY = 'zaff-receive-draft';
const norm = (code: string) => code.replace(/\s+/g, '').toUpperCase();
const details = (p: Product) => [p.model, p.color].filter(Boolean).join(' · ');

function loadDraft(): Item[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const list = raw ? (JSON.parse(raw) as Item[]) : [];
    // Un appareil « en cours de vérification » au moment de la fermeture est revérifié à l'enregistrement
    return list.filter((i) => i.state !== 'saved').map((i) => (i.state === 'checking' || i.state === 'saving' ? { ...i, state: 'ready' as const } : i));
  } catch {
    return [];
  }
}

export default function ReceiveStockPage() {
  return (
    <Suspense fallback={null}>
      <ReceiveStock />
    </Suspense>
  );
}

function ReceiveStock() {
  const { data: productsData } = useProducts();
  const products = useMemo(() => productsData ?? [], [productsData]);
  const params = useSearchParams();
  const addUnits = useAddUnits();

  const [currentId, setCurrentId] = useState<string | null>(params.get('product'));
  const [items, setItems] = useState<Item[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null);
  /** N° scanné alors qu'aucun modèle n'est choisi : il attend le choix du modèle */
  const [waiting, setWaiting] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { forGroup?: string }>(null);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [summary, setSummary] = useState<Array<{ name: string; count: number }> | null>(null);
  const seededSerial = useRef(false);

  const byId = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const current = currentId ? byId.get(currentId) ?? null : null;

  // Brouillon : relu au chargement, enregistré à chaque changement
  useEffect(() => {
    setItems(loadDraft());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(items.filter((i) => i.state !== 'saved')));
    } catch {
      /* stockage indisponible : le panier reste en mémoire */
    }
  }, [items, hydrated]);

  const patch = (serial: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.serial === serial ? { ...i, ...p } : i)));

  /** Vérifie tout de suite qu'un N° n'est pas déjà connu de la boutique */
  const check = async (serial: string) => {
    try {
      const r = (await api.get(`/units/lookup/${encodeURIComponent(serial)}`)) as unknown as ScanLookup;
      if (r.type === 'unit') {
        const st = r.unit.status;
        const why =
          st === 'in_stock' ? `Déjà en stock (${r.product.name})` : st === 'sold' ? `Déjà enregistré et vendu (${r.product.name})` : `Déjà enregistré (${r.product.name})`;
        patch(serial, { state: 'conflict', note: why });
        scanFeedback(false);
      } else {
        patch(serial, { state: 'ready', note: undefined });
      }
    } catch {
      // Inconnu de la boutique (404) : c'est bien un nouvel appareil
      patch(serial, { state: 'ready', note: undefined });
    }
  };

  const addSerial = (serial: string, productId: string) => {
    if (items.some((i) => i.serial === serial)) {
      scanFeedback(false);
      setMessage({ tone: 'warn', text: `${serial} est déjà dans la liste.` });
      return;
    }
    scanFeedback(true);
    setMessage(null);
    setItems((list) => [{ serial, productId, state: 'checking', at: Date.now() }, ...list]);
    check(serial);
  };

  const chooseModel = (p: Product, firstSerial?: string) => {
    setCurrentId(p._id);
    if (picker?.forGroup) {
      // Tout le groupe change de modèle
      const from = picker.forGroup;
      setItems((list) => list.map((i) => (i.productId === from && i.state !== 'saved' ? { ...i, productId: p._id } : i)));
    } else if (waiting) {
      addSerial(waiting, p._id);
      setWaiting(null);
    }
    // IMEI tapé par erreur dans « Code-barres de la boîte » du nouveau modèle : 1er appareil du panier
    if (firstSerial && firstSerial !== waiting) addSerial(norm(firstSerial), p._id);
    setPicker(null);
    setMessage({ tone: 'ok', text: `Modèle en cours : ${p.name}${details(p) ? ` · ${details(p)}` : ''}` });
  };

  // IMEI saisi dans la fiche du modèle (lien depuis le Catalogue) : 1er appareil du panier
  useEffect(() => {
    const s = params.get('serial');
    if (!s || seededSerial.current || !hydrated || !currentId || !byId.get(currentId)) return;
    seededSerial.current = true;
    addSerial(norm(s), currentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentId, byId]);

  const onScan = (raw: string) => {
    const code = norm(raw);
    if (!code) return;
    setSummary(null);
    // 1) Code-barres d'une boîte → change le modèle en cours (un IMEI n'est jamais un code de boîte)
    const box = products.find((p) => p.barcode && norm(p.barcode) === code);
    if (box && imeiCheck(code) !== 'valid') {
      if (!box.hasSerialNumbers) {
        scanFeedback(false);
        setMessage({ tone: 'warn', text: `« ${box.name} » n'est pas suivi par N° de série : mettez-le en stock depuis Stock.` });
        return;
      }
      scanFeedback(true);
      setCurrentId(box._id);
      setMessage({ tone: 'ok', text: `Boîte reconnue → modèle en cours : ${box.name}${details(box) ? ` · ${details(box)}` : ''}. Scannez maintenant les IMEI.` });
      return;
    }
    // Ancienne fiche dont le « code-barres » est en réalité l'IMEI d'un téléphone : on le range sous ce modèle
    const legacy = box && imeiCheck(code) === 'valid' ? box : null;
    // 2) IMEI tapé avec une faute ?
    if (imeiCheck(code) === 'invalid') {
      scanFeedback(false);
      setSuspect(code);
      return;
    }
    const target = legacy ?? current;
    if (!target) {
      setWaiting(code);
      setPicker({});
      return;
    }
    if (legacy) setCurrentId(legacy._id);
    addSerial(code, target._id);
  };

  const handlePaste = () => {
    if (!current) {
      setPicker({});
      return;
    }
    const serials = pasteText.split(/[\n,;\t]+/).map(norm).filter(Boolean);
    serials.forEach((s) => addSerial(s, current._id));
    setPasteText('');
    setPasteOpen(false);
  };

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) m.set(i.productId, [...(m.get(i.productId) || []), i]);
    return [...m.entries()];
  }, [items]);
  const toSave = items.filter((i) => i.state === 'ready' || i.state === 'rejected');
  const checking = items.some((i) => i.state === 'checking');

  const save = async () => {
    const ready = items.filter((i) => i.state === 'ready');
    if (!ready.length) return;
    setMessage(null);
    const byProduct = new Map<string, string[]>();
    ready.forEach((i) => byProduct.set(i.productId, [...(byProduct.get(i.productId) || []), i.serial]));
    setItems((list) => list.map((i) => (i.state === 'ready' ? { ...i, state: 'saving' } : i)));
    const done: Array<{ name: string; count: number }> = [];
    for (const [productId, serials] of byProduct) {
      try {
        const res = await addUnits.mutateAsync({ productId, serialNumbers: serials });
        const ok = new Set(res.created.map((u) => u.serialNumber));
        const why = new Map(res.rejected.map((r) => [r.serialNumber, r.reason]));
        setItems((list) =>
          list.map((i) =>
            i.productId === productId && serials.includes(i.serial)
              ? ok.has(i.serial)
                ? { ...i, state: 'saved', note: undefined }
                : { ...i, state: 'rejected', note: why.get(i.serial) || 'Refusé' }
              : i,
          ),
        );
        if (ok.size) done.push({ name: byId.get(productId)?.name || 'Modèle', count: ok.size });
      } catch (e) {
        setItems((list) => list.map((i) => (i.productId === productId && serials.includes(i.serial) ? { ...i, state: 'rejected', note: errorMessage(e) } : i)));
      }
    }
    scanFeedback(done.length > 0);
    setSummary(done);
    // Les appareils enregistrés quittent le panier ; les refusés restent, avec la raison
    setTimeout(() => setItems((list) => list.filter((i) => i.state !== 'saved')), 1500);
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-gold" /> Mise en stock
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">Scannez la boîte pour choisir le modèle, puis l&apos;IMEI de chaque téléphone.</p>
        </div>
        <button onClick={() => setPicker({})} className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0">
          <ArrowRightLeft className="w-4 h-4" /> Modèle
        </button>
      </div>

      {/* Modèle en cours : reste choisi d'un scan à l'autre */}
      <button
        onClick={() => setPicker({})}
        className={cn('w-full text-left rounded-3xl border p-4 flex items-center gap-4', current ? 'border-gold/50 bg-neutral-950' : 'border-dashed border-neutral-700 bg-neutral-950')}
      >
        {current ? (
          <>
            <ProductVisual imageId={current.imageId} category={current.category} brand={current.brand} name={current.name} size="thumb" className="w-14 h-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Modèle en cours</p>
              <p className="text-base font-bold text-white truncate">{current.name}</p>
              <p className="text-xs text-neutral-400 truncate">{[current.brand, details(current)].filter(Boolean).join(' · ') || current.sku}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black text-gold-soft">{items.filter((i) => i.productId === current._id && i.state !== 'conflict').length}</p>
              <p className="text-[10px] text-neutral-500">scanné(s) · {current.stockQuantity} en stock</p>
            </div>
          </>
        ) : (
          <div className="flex-1 text-center py-2">
            <p className="text-sm font-semibold text-white">Aucun modèle choisi</p>
            <p className="text-xs text-neutral-400">Scannez le code-barres de la boîte, ou touchez ici pour choisir / créer le modèle.</p>
          </div>
        )}
      </button>

      <BarcodeScanner
        onScan={onScan}
        paused={!!suspect || !!picker}
        placeholder="Scannez la boîte ou l'IMEI / N° de série"
        hint="Boîte (code EAN) = choisit le modèle · IMEI / N° de série = ajoute un appareil. *#06# sur le téléphone affiche son IMEI."
      />

      {message && (
        <p className={cn('text-xs', message.tone === 'ok' ? 'text-emerald-400' : message.tone === 'warn' ? 'text-amber-400' : 'text-red-400')}>{message.text}</p>
      )}

      {suspect && (
        <div role="alert" className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
          <p className="text-sm text-white">
            <AlertTriangle className="inline w-4 h-4 text-amber-400 mr-1 -mt-0.5" />
            Le N° <span className="font-mono font-bold">{suspect}</span> ne ressemble pas à un IMEI valide (chiffre de contrôle). Faute de frappe ?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setSuspect(null)} className="h-11 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold">
              Corriger
            </button>
            <button
              onClick={() => {
                const code = suspect;
                setSuspect(null);
                if (current) addSerial(code, current._id);
                else {
                  setWaiting(code);
                  setPicker({});
                }
              }}
              className="h-11 rounded-xl bg-amber-500 text-ink text-sm font-bold"
            >
              Ajouter quand même
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <button onClick={() => setPasteOpen(!pasteOpen)} className="text-neutral-400 hover:text-white flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4" /> Coller une liste de N° de série
        </button>
        <Link href="/app/labels" className="text-gold-soft underline">
          Appareil sans N° lisible ? Étiquette QR
        </Link>
      </div>
      {pasteOpen && (
        <div className="space-y-2">
          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'Un N° par ligne\n356789104523871\n356789104523889'}
            className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-3 text-sm font-mono text-white focus:outline-none focus:border-gold"
          />
          <button onClick={handlePaste} className="w-full h-11 rounded-2xl bg-gold text-ink font-bold text-sm">
            Ajouter la liste {current ? `à ${current.name}` : ''}
          </button>
        </div>
      )}

      {summary && summary.length > 0 && (
        <BlurFade className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-1">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Mis en stock
          </p>
          {summary.map((s) => (
            <p key={s.name} className="text-xs text-neutral-200">
              {s.count} × {s.name}
            </p>
          ))}
        </BlurFade>
      )}

      {/* Panier : une carte par appareil, groupées par modèle */}
      {groups.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 py-6">Chaque appareil scanné apparaît ici. Rien n&apos;est en stock avant « Enregistrer ».</p>
      ) : (
        groups.map(([productId, list]) => {
          const p = byId.get(productId);
          const count = list.filter((i) => i.state !== 'conflict').length;
          return (
            <div key={productId} className="rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-900">
                {p && <ProductVisual imageId={p.imageId} category={p.category} brand={p.brand} name={p.name} size="thumb" className="w-10 h-10 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{p?.name || 'Modèle supprimé'}</p>
                  <p className="text-[11px] text-neutral-500 truncate">{p ? details(p) : ''}</p>
                </div>
                <span className="text-sm font-black text-gold-soft shrink-0">× {count}</span>
                <button onClick={() => setPicker({ forGroup: productId })} className="text-[11px] text-neutral-400 underline shrink-0">
                  Autre modèle
                </button>
              </div>
              <div className="divide-y divide-neutral-900">
                {list.map((i) => (
                  <div key={i.serial} className={cn('flex items-center gap-3 px-4 py-2.5', i.state === 'saved' && 'bg-emerald-500/5', (i.state === 'conflict' || i.state === 'rejected') && 'bg-red-500/5')}>
                    {i.state === 'checking' || i.state === 'saving' ? (
                      <Loader2 className="w-4 h-4 text-neutral-500 animate-spin shrink-0" />
                    ) : i.state === 'saved' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : i.state === 'conflict' || i.state === 'rejected' ? (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-gold shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm text-white truncate">{i.serial}</p>
                      <p className={cn('text-[11px]', i.state === 'conflict' || i.state === 'rejected' ? 'text-red-400' : 'text-neutral-500')}>
                        {i.state === 'checking'
                          ? 'Vérification…'
                          : i.state === 'saving'
                            ? 'Enregistrement…'
                            : i.state === 'saved'
                              ? 'En stock'
                              : i.note || 'Prêt à enregistrer'}
                      </p>
                    </div>
                    {i.state !== 'saving' && i.state !== 'saved' && (
                      <button onClick={() => setItems((l) => l.filter((x) => x.serial !== i.serial))} className="p-2 text-neutral-500 hover:text-red-400" aria-label={`Retirer ${i.serial}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Barre d'enregistrement */}
      {items.some((i) => i.state !== 'saved') && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
          <div className="max-w-xl mx-auto flex gap-2">
            <button
              onClick={() => window.confirm('Vider la liste ? Rien ne sera mis en stock.') && setItems([])}
              className="h-12 px-4 rounded-2xl border border-neutral-700 bg-neutral-950 text-neutral-300 text-sm font-semibold"
            >
              Vider
            </button>
            <button
              onClick={save}
              disabled={!items.some((i) => i.state === 'ready') || checking || addUnits.isPending}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-sm disabled:opacity-50"
            >
              {addUnits.isPending
                ? 'Enregistrement…'
                : checking
                  ? 'Vérification…'
                  : `Enregistrer ${items.filter((i) => i.state === 'ready').length} appareil(s) en stock`}
            </button>
          </div>
          {toSave.some((i) => i.state === 'rejected') && (
            <p className="max-w-xl mx-auto text-[11px] text-red-400 mt-1">Les appareils refusés restent dans la liste : corrigez ou retirez-les.</p>
          )}
        </div>
      )}

      {picker && <ModelPicker products={products} waiting={waiting} onPick={chooseModel} onClose={() => (setPicker(null), setWaiting(null))} />}
    </div>
  );
}

function ModelPicker({ products, waiting, onPick, onClose }: { products: Product[]; waiting: string | null; onPick: (p: Product, firstSerial?: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const list = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products
      .filter((p) => p.hasSerialNumbers)
      .filter((p) => !q || [p.name, p.brand, p.model, p.color, p.sku, p.barcode].some((v) => v?.toLowerCase().includes(q)));
  }, [products, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl px-5 pt-5 pb-4 max-w-xl w-full max-h-[94vh] overflow-y-auto space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{createOpen ? 'Nouveau modèle' : 'Choisir le modèle'}</h2>
            {waiting && (
              <p className="text-xs text-neutral-400">
                Pour l&apos;appareil <span className="font-mono text-white">{waiting}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {createOpen ? (
          <ProductForm compact onCancel={() => setCreateOpen(false)} onSaved={(p, extra) => onPick(p, extra?.firstSerial)} onUseExisting={(p) => onPick(p)} />
        ) : (
          <>
            <button onClick={() => setCreateOpen(true)} className="w-full h-11 rounded-xl border border-dashed border-gold/50 text-gold-soft text-sm font-semibold flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Nouveau modèle
            </button>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cherchez le modèle (nom, marque, couleur)"
                autoFocus
                className="w-full h-11 pl-10 pr-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-gold"
              />
            </div>
            {list.length === 0 ? (
              <p className="text-center text-sm text-neutral-500 py-4">Aucun modèle suivi par N° de série. Créez-le avec « Nouveau modèle ».</p>
            ) : (
              list.map((p) => (
                <button
                  key={p._id}
                  onClick={() => onPick(p)}
                  className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-900 hover:border-gold px-3 py-2.5 flex items-center gap-3"
                >
                  <ProductVisual imageId={p.imageId} category={p.category} brand={p.brand} name={p.name} size="thumb" className="w-10 h-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{p.name}</p>
                    <p className="text-xs text-neutral-400 truncate">{[p.brand, details(p)].filter(Boolean).join(' · ') || p.sku}</p>
                  </div>
                  <span className="text-xs text-neutral-400 shrink-0">{p.stockQuantity} en stock</span>
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
