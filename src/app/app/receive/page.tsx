'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, ClipboardList, History, Layers, Loader2, PackagePlus, Plus, Search, Trash2, X } from 'lucide-react';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { ProductForm } from '@/components/products/product-form';
import { ProductVisual } from '@/components/products/product-visual';
import { BlurFade } from '@/components/magicui/blur-fade';
import { api } from '@/lib/api';
import { imeiCheck } from '@/lib/imei';
import { useCategories, useCreateReception, useCreateVariant, useProducts } from '@/lib/queries';
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
const low = (v?: string | null) => (v || '').trim().toLowerCase();
/** Même famille = même catégorie, marque et nom : seules la capacité et la couleur changent (fiches et stocks séparés) */
const familyKey = (p: Product) => [p.category, low(p.brand), low(p.name)].join('|');
const ASK_KEY = 'zaff-receive-ask';

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
  const reception = useCreateReception();
  const { data: categories = [] } = useCategories();
  const catName = (slug?: string | null) => categories.find((c) => c.slug === slug)?.name || (slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Sans catégorie');
  /** Demander capacité / couleur à chaque appareil scanné (réglage mémorisé sur l'appareil) */
  const [askVersion, setAskVersion] = useState(() => {
    try {
      return localStorage.getItem(ASK_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [versionFor, setVersionFor] = useState<string | null>(null);

  const [currentId, setCurrentId] = useState<string | null>(params.get('product'));
  // Brouillon relu au chargement (page rendue côté navigateur : useSearchParams sous <Suspense>)
  const [items, setItems] = useState<Item[]>(() => (typeof window === 'undefined' ? [] : loadDraft()));
  const hydrated = typeof window !== 'undefined';
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null);
  /** N° scanné alors qu'aucun modèle n'est choisi : il attend le choix du modèle */
  const [waiting, setWaiting] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { forGroup?: string }>(null);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [summary, setSummary] = useState<{ code: string; total: number; byCategory: Array<{ categoryName: string; quantity: number }> } | null>(null);
  const seededSerial = useRef(false);

  const byId = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const current = currentId ? byId.get(currentId) ?? null : null;
  const family = useMemo(() => (current ? products.filter((p) => p.hasSerialNumbers && familyKey(p) === familyKey(current)) : []), [products, current]);

  // Brouillon enregistré à chaque changement
  const toggleAsk = () => {
    setAskVersion((v) => {
      try {
        localStorage.setItem(ASK_KEY, v ? '0' : '1');
      } catch {
        /* ignoré */
      }
      return !v;
    });
  };
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

  const addSerial = (serial: string, productId: string): boolean => {
    if (items.some((i) => i.serial === serial)) {
      scanFeedback(false);
      setMessage({ tone: 'warn', text: `${serial} est déjà dans la liste.` });
      return false;
    }
    scanFeedback(true);
    setMessage(null);
    setItems((list) => [{ serial, productId, state: 'checking', at: Date.now() }, ...list]);
    check(serial);
    return true;
  };

  /** Version confirmée pour l'appareil scanné : il passe sur cette fiche, qui devient le modèle en cours */
  const assignVersion = (serial: string, p: Product) => {
    setItems((list) => list.map((i) => (i.serial === serial ? { ...i, productId: p._id } : i)));
    setCurrentId(p._id);
    setVersionFor(null);
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
    const added = addSerial(code, target._id);
    // Gagner du temps : même modèle → on confirme seulement la capacité et la couleur de CET appareil
    if (added && askVersion && !legacy) setVersionFor(code);
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
    try {
      const res = await reception.mutateAsync({ items: [...byProduct].map(([productId, serialNumbers]) => ({ productId, serialNumbers })) });
      const ok = new Set(res.results.flatMap((r) => r.created));
      const why = new Map(res.results.flatMap((r) => r.rejected.map((x) => [x.serialNumber, x.reason] as const)));
      setItems((list) =>
        list.map((i) =>
          i.state !== 'saving' ? i : ok.has(i.serial) ? { ...i, state: 'saved', note: undefined } : { ...i, state: 'rejected', note: why.get(i.serial) || 'Refusé' },
        ),
      );
      scanFeedback(ok.size > 0);
      if (res.reception) setSummary({ code: res.reception.code, total: res.reception.totalUnits, byCategory: res.reception.byCategory });
    } catch (e) {
      scanFeedback(false);
      setItems((list) => list.map((i) => (i.state === 'saving' ? { ...i, state: 'ready', note: undefined } : i)));
      setMessage({ tone: 'bad', text: errorMessage(e) });
    }
    // Les appareils enregistrés quittent le panier ; les refusés restent, avec la raison
    setTimeout(() => setItems((list) => list.filter((i) => i.state !== 'saved')), 1500);
  };

  /** Compteur de la livraison : catégorie → modèle (capacité / couleur séparées) */
  const counter = useMemo(() => {
    const cats = new Map<string, { name: string; total: number; models: Map<string, number> }>();
    for (const i of items) {
      if (i.state === 'conflict' || i.state === 'rejected') continue;
      const p = byId.get(i.productId);
      const slug = p?.category || '';
      const c = cats.get(slug) || { name: catName(slug), total: 0, models: new Map<string, number>() };
      c.total += 1;
      c.models.set(i.productId, (c.models.get(i.productId) || 0) + 1);
      cats.set(slug, c);
    }
    return [...cats.values()].sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, byId, categories]);
  const counted = counter.reduce((a, c) => a + c.total, 0);

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

      {current && (
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {family.map((v) => {
              const n = items.filter((i) => i.productId === v._id && i.state !== 'conflict').length;
              return (
                <button
                  key={v._id}
                  onClick={() => setCurrentId(v._id)}
                  className={cn('shrink-0 h-9 px-3 rounded-full border text-xs font-semibold', v._id === current._id ? 'border-gold bg-gold/15 text-gold-soft' : 'border-neutral-800 text-neutral-400')}
                >
                  {details(v) || 'Standard'}
                  {n ? ` · ${n}` : ''}
                </button>
              );
            })}
            <button onClick={() => setVersionFor('')} className="shrink-0 h-9 px-3 rounded-full border border-dashed border-gold/50 text-xs font-semibold text-gold-soft">
              + Autre capacité / couleur
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-neutral-400">
            <input type="checkbox" checked={askVersion} onChange={toggleAsk} className="accent-[var(--color-gold,#d4a017)]" />
            Demander la capacité et la couleur à chaque appareil scanné
          </label>
        </div>
      )}

      <BarcodeScanner
        onScan={onScan}
        paused={!!suspect || !!picker || versionFor !== null}
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
        <span className="flex items-center gap-3">
          <Link href="/app/receptions" className="text-neutral-400 hover:text-white flex items-center gap-1">
            <History className="w-3.5 h-3.5" /> Historique
          </Link>
          <Link href="/app/labels" className="text-gold-soft underline">
            Sans N° lisible ? Étiquette QR
          </Link>
        </span>
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

      {summary && (
        <BlurFade className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-1">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Réception {summary.code} : {summary.total} article(s) en stock
          </p>
          <p className="text-xs text-neutral-200">{summary.byCategory.map((c) => `${c.categoryName} ${c.quantity}`).join(' · ')}</p>
          <Link href="/app/receptions" className="text-[11px] text-gold-soft underline">
            Voir l&apos;historique des réceptions
          </Link>
        </BlurFade>
      )}

      {/* Compteur de la livraison : utile quand on ne connaît pas les quantités à l'avance */}
      {counted > 0 && (
        <div className="rounded-2xl border border-gold/30 bg-neutral-950 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Compteur de la livraison
            </p>
            <p className="text-2xl font-black text-gold-soft">{counted}</p>
          </div>
          {counter.map((c) => (
            <div key={c.name} className="space-y-0.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-white">{c.name}</span>
                <span className="font-bold text-white">{c.total}</span>
              </div>
              {[...c.models].map(([pid, n]) => {
                const p = byId.get(pid);
                return (
                  <div key={pid} className="flex items-center justify-between text-[11px] text-neutral-400 pl-3">
                    <span className="truncate">
                      {p?.name} {p ? `· ${details(p)}` : ''}
                    </span>
                    <span className="font-mono">× {n}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
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
                  <p className="text-[11px] text-neutral-500 truncate">{p ? [catName(p.category), details(p)].filter(Boolean).join(' · ') : ''}</p>
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
              disabled={!items.some((i) => i.state === 'ready') || checking || reception.isPending}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-sm disabled:opacity-50"
            >
              {reception.isPending
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

      {versionFor !== null && current && (
        <VersionSheet
          base={current}
          family={family}
          serial={versionFor || null}
          onChoose={(p) => (versionFor ? assignVersion(versionFor, p) : (setCurrentId(p._id), setVersionFor(null)))}
          onClose={() => setVersionFor(null)}
        />
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

function Chips({ values, value, onPick, placeholder }: { values: string[]; value: string; onPick: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button key={v} onClick={() => onPick(v)} className={cn('h-11 px-4 rounded-xl border text-sm font-semibold', low(v) === low(value) ? 'border-gold bg-gold/15 text-gold-soft' : 'border-neutral-800 text-neutral-300')}>
          {v}
        </button>
      ))}
      <input
        value={values.some((v) => low(v) === low(value)) ? '' : value}
        onChange={(e) => onPick(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-32 rounded-xl border border-dashed border-neutral-700 bg-transparent px-3 text-sm text-white"
        aria-label={placeholder}
      />
    </div>
  );
}

/**
 * Version de l'appareil (capacité / couleur) : pastilles des versions déjà connues du modèle, saisie libre sinon.
 * Une combinaison inconnue crée une nouvelle fiche (mêmes prix, stock séparé) : un iPhone 11 64 Go et un 128 Go
 * ne sont jamais mélangés.
 */
function VersionSheet({ base, family, serial, onChoose, onClose }: { base: Product; family: Product[]; serial: string | null; onChoose: (p: Product) => void; onClose: () => void }) {
  const createVariant = useCreateVariant();
  const caps = [...new Set(family.map((p) => p.model?.trim()).filter(Boolean) as string[])];
  const colors = [...new Set(family.map((p) => p.color?.trim()).filter(Boolean) as string[])];
  const [cap, setCap] = useState(base.model?.trim() || '');
  const [color, setColor] = useState(base.color?.trim() || '');
  const [error, setError] = useState<string | null>(null);
  const match = family.find((p) => low(p.model) === low(cap) && low(p.color) === low(color));

  const confirm = async () => {
    setError(null);
    if (match) return onChoose(match);
    try {
      const r = await createVariant.mutateAsync({ id: base._id, model: cap.trim(), color: color.trim() });
      onChoose(r.product);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" onKeyDown={(e) => e.key === 'Enter' && confirm()}>
      <div className="w-full sm:max-w-md bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{base.name} : quelle version ?</h2>
            {serial && <p className="text-xs text-neutral-400 font-mono">{serial}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-neutral-400">Capacité / configuration</p>
          <Chips values={caps} value={cap} onPick={setCap} placeholder="Autre (ex : 256 Go)" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-neutral-400">Couleur</p>
          <Chips values={colors} value={color} onPick={setColor} placeholder="Autre couleur" />
        </div>
        <p className="text-[11px] text-neutral-500">
          {match ? `Fiche existante · ${match.stockQuantity} en stock` : 'Nouvelle version : une fiche séparée sera créée (mêmes prix, stock à part).'}
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={confirm} disabled={createVariant.isPending} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold disabled:opacity-60">
          {createVariant.isPending ? 'Création…' : `OK · ${[cap, color].filter(Boolean).join(' · ') || 'Standard'}`}
        </button>
      </div>
    </div>
  );
}
