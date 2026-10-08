'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { errorMessage, type Product } from '@/lib/types';
import { useAddUnits, useDeleteUnit, useProducts } from '@/lib/queries';
import { ProductForm } from '@/components/products/product-form';
import { imeiCheck } from '@/lib/imei';
import { BlurFade } from '@/components/magicui/blur-fade';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { AnimatedList, AnimatedListItem } from '@/components/magicui/animated-list';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, PackagePlus, Plus, Search, Undo2, X } from 'lucide-react';

type ScanResult =
  | { status: 'ok'; serialNumber: string; unitId: string; at: Date }
  | { status: 'rejected'; serialNumber: string; reason: string; at: Date }
  | { status: 'undone'; serialNumber: string; at: Date };

export default function ReceiveStockPage() {
  return (
    <Suspense fallback={null}>
      <ReceiveStock />
    </Suspense>
  );
}

function ReceiveStock() {
  const products = useProducts().data ?? [];
  // « Mettre en stock » depuis le Catalogue (ou après la création d'un produit) : le modèle est déjà choisi
  const wantedId = useSearchParams().get('product');
  const [wantedDismissed, setWantedDismissed] = useState(false);
  const addUnits = useAddUnits();
  const deleteUnit = useDeleteUnit();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Product | null>(null);
  const wanted = !picked && !wantedDismissed && wantedId ? products.find((p) => p._id === wantedId && p.hasSerialNumbers) ?? null : null;
  const selected = picked ?? wanted;
  const setSelected = (p: Product | null) => {
    setPicked(p);
    if (!p) setWantedDismissed(true);
  };
  const [results, setResults] = useState<ScanResult[]>([]);
  const [stockQuantity, setStockQuantity] = useState<number | null>(null);
  const isSending = addUnits.isPending;
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  /** IMEI tapé qui ne passe pas le contrôle : on demande confirmation avant de le mettre en stock */
  const [suspect, setSuspect] = useState<string | null>(null);

  // Création rapide d'un modèle
  const [createOpen, setCreateOpen] = useState(false);
  // Code-barres scanné inconnu : repris dans la fiche du nouveau modèle
  const [scannedBarcode, setScannedBarcode] = useState('');

  const serialProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products
      .filter((p) => p.hasSerialNumbers)
      .filter(
        (p) =>
          !q ||
          [p.name, p.brand, p.model, p.color, p.sku, p.barcode].some((v) => v?.toLowerCase().includes(q))
      );
  }, [products, search]);

  const added = results.filter((r) => r.status === 'ok').length;

  const selectProduct = (p: Product) => {
    setSelected(p);
    setStockQuantity(p.stockQuantity);
    setResults([]);
    setMessage(null);
  };

  /** Étape 1 : un scan sert à choisir le modèle par son code-barres */
  const handleModelScan = (code: string) => {
    const p = products.find((x) => x.barcode && x.barcode === code.trim());
    if (p && p.hasSerialNumbers) {
      scanFeedback(true);
      selectProduct(p);
    } else if (p) {
      scanFeedback(false);
      setMessage(`« ${p.name} » n'est pas suivi par N° de série : activez l'option dans le catalogue.`);
    } else {
      scanFeedback(false);
      setMessage(`Aucun modèle avec le code-barres ${code}. Créez-le avec « Nouveau modèle ».`);
      setScannedBarcode(code.trim());
    }
  };

  const sendSerials = async (serialNumbers: string[]) => {
    if (!selected || serialNumbers.length === 0) return;
    try {
      const res = await addUnits.mutateAsync({ productId: selected._id, serialNumbers });
      const now = new Date();
      const ok: ScanResult[] = res.created.map((u) => ({ status: 'ok', serialNumber: u.serialNumber, unitId: u._id, at: now }));
      const ko: ScanResult[] = res.rejected.map((r) => ({ status: 'rejected', serialNumber: r.serialNumber, reason: r.reason, at: now }));
      setResults((prev) => [...ok, ...ko, ...prev]);
      setStockQuantity(res.stockQuantity);
      scanFeedback(ko.length === 0);
    } catch (err) {
      scanFeedback(false);
      setResults((prev) => [
        ...serialNumbers.map((s) => ({ status: 'rejected' as const, serialNumber: s, reason: errorMessage(err), at: new Date() })),
        ...prev,
      ]);
    }
  };

  /** Étape 2 : chaque scan = un appareil mis en stock */
  const handleSerialScan = (code: string) => {
    if (selected?.barcode && code.trim() === selected.barcode) {
      scanFeedback(false);
      setResults((prev) => [
        {
          status: 'rejected',
          serialNumber: code,
          reason: "C'est le code-barres du modèle : scannez le N° de série / IMEI de l'appareil.",
          at: new Date(),
        },
        ...prev,
      ]);
      return;
    }
    if (imeiCheck(code) === 'invalid') {
      scanFeedback(false);
      setSuspect(code.replace(/[\s-]/g, ''));
      return;
    }
    setSuspect(null);
    sendSerials([code]);
  };

  const handlePaste = () => {
    const serials = pasteText.split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean);
    const bad = serials.filter((s) => imeiCheck(s) === 'invalid');
    if (bad.length && !window.confirm(`${bad.length} N° ne passe(nt) pas le contrôle IMEI (${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}). Les mettre en stock quand même ?`)) return;
    sendSerials(serials);
    setPasteText('');
    setPasteOpen(false);
  };

  const undo = async (r: Extract<ScanResult, { status: 'ok' }>) => {
    try {
      await deleteUnit.mutateAsync(r.unitId);
      setResults((prev) =>
        prev.map((x) => (x.status === 'ok' && x.unitId === r.unitId ? { status: 'undone', serialNumber: r.serialNumber, at: new Date() } : x))
      );
      setStockQuantity((q) => (q === null ? q : q - 1));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // ─── Étape 2 : scan des appareils ──────────────────────────────────────
  if (selected) {
    const details = [selected.brand, selected.model, selected.color].filter(Boolean).join(' · ');
    return (
      <BlurFade className="max-w-xl mx-auto space-y-5">
        <button onClick={() => setSelected(null)} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Changer de modèle
        </button>

        <div className="rounded-3xl border border-gold/40 bg-neutral-950 p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Modèle en cours</p>
            <p className="text-lg font-bold text-white truncate">{selected.name}</p>
            {details && <p className="text-xs text-neutral-400 truncate">{details}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-black text-gold-soft">
              +<NumberTicker value={added} />
            </p>
            <p className="text-[10px] text-neutral-500">ajouté(s) · {products.find((p) => p._id === selected._id)?.stockQuantity ?? stockQuantity ?? '—'} en stock</p>
          </div>
        </div>

        <BarcodeScanner
          onScan={handleSerialScan}
          paused={!!suspect}
          placeholder="Scannez ou tapez le N° de série / IMEI"
          hint="Douchette, caméra (bouton Caméra) ou clavier : tapez le numéro puis « OK ». « 123 » ouvre le clavier chiffres. IMEI : *#06# sur le téléphone ou étiquette de la boîte."
        />

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
                  sendSerials([code]);
                }}
                className="h-11 rounded-xl bg-amber-500 text-ink text-sm font-bold"
              >
                Mettre en stock quand même
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <button onClick={() => setPasteOpen(!pasteOpen)} className="text-neutral-400 hover:text-white flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4" /> Coller une liste de N° de série
          </button>
          {isSending && <span className="text-neutral-500">Enregistrement…</span>}
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
            <button
              onClick={handlePaste}
              className="w-full h-11 rounded-2xl bg-gold text-ink font-bold text-sm hover:brightness-110"
            >
              Mettre en stock la liste
            </button>
          </div>
        )}

        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 py-6">
              Scannez les appareils un par un : chaque scan est confirmé ici.
            </p>
          ) : (
            <AnimatedList>
            {results.map((r) => (
              <AnimatedListItem key={`${r.serialNumber}-${r.at.getTime()}-${r.status}`}>
              <div
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                  r.status === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : r.status === 'undone'
                    ? 'border-neutral-800 bg-neutral-900/40 opacity-60'
                    : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {r.status === 'ok' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : r.status === 'undone' ? (
                    <Undo2 className="w-5 h-5 text-neutral-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-white truncate">{r.serialNumber}</p>
                    <p className="text-[11px] text-neutral-400">
                      {r.status === 'ok' ? 'En stock' : r.status === 'undone' ? 'Annulé' : r.reason}
                    </p>
                  </div>
                </div>
                {r.status === 'ok' && (
                  <button onClick={() => undo(r)} className="text-[11px] text-neutral-400 hover:text-red-400 shrink-0">
                    Annuler
                  </button>
                )}
              </div>
              </AnimatedListItem>
            ))}
            </AnimatedList>
          )}
        </div>

        {added > 0 && (
          <button
            onClick={() => setSelected(null)}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-sm"
          >
            Terminer ({added} appareil{added > 1 ? 's' : ''} mis en stock)
          </button>
        )}
      </BlurFade>
    );
  }

  // ─── Étape 1 : choix du modèle ─────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-gold" /> Mise en stock
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">1. Choisissez le modèle · 2. Scannez chaque appareil</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-3 py-2 rounded-xl bg-gold text-ink font-bold text-xs flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Nouveau modèle
        </button>
      </div>

      <BarcodeScanner
        onScan={handleModelScan}
        paused={createOpen}
        placeholder="Scannez ou tapez le code-barres de la boîte"
        hint="Code-barres EAN imprimé sur la boîte (13 chiffres en général), ou choisissez le modèle dans la liste."
      />
      {message && <p className="text-xs text-amber-400">{message}</p>}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="…ou cherchez le modèle (nom, marque, couleur)"
          className="w-full h-11 pl-10 pr-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-gold"
        />
      </div>

      <div className="space-y-2">
        {serialProducts.length === 0 ? (
          <p className="text-center text-sm text-neutral-500 py-6">
            Aucun modèle suivi par N° de série. Créez-en un avec « Nouveau modèle ».
          </p>
        ) : (
          serialProducts.map((p) => (
            <button
              key={p._id}
              onClick={() => selectProduct(p)}
              className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-950 hover:border-gold px-4 py-3 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{p.name}</p>
                <p className="text-xs text-neutral-400 truncate">
                  {[p.brand, p.model, p.color].filter(Boolean).join(' · ') || p.sku}
                </p>
              </div>
              <span className="text-xs text-neutral-400 shrink-0">{p.stockQuantity} en stock</span>
            </button>
          ))
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl px-5 pt-5 pb-3 max-w-xl w-full relative max-h-[94vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Nouveau modèle</h2>
                <p className="text-xs text-neutral-400">Suivi par N° de série : le stock se remplit en scannant chaque appareil.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-1 text-neutral-400 hover:text-white" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ProductForm
              compact
              defaults={{ barcode: scannedBarcode }}
              onCancel={() => setCreateOpen(false)}
              onSaved={(product) => {
                setCreateOpen(false);
                setScannedBarcode('');
                selectProduct(product);
              }}
              onUseExisting={(product) => {
                setCreateOpen(false);
                selectProduct(product);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
