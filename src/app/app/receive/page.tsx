'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { errorMessage, type Category, type Product } from '@/lib/types';
import { useAddUnits, useCategories, useDeleteUnit, useProducts, useReferenceCatalog } from '@/lib/queries';
import { qk } from '@/lib/query-keys';
import { fieldErrors, NewModelSchema } from '@/lib/schemas';
import { CONDITION_LABELS, type ProductCondition } from '@/lib/contract';
import { BlurFade } from '@/components/magicui/blur-fade';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { AnimatedList, AnimatedListItem } from '@/components/magicui/animated-list';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, PackagePlus, Plus, Search, Undo2, X } from 'lucide-react';

type ScanResult =
  | { status: 'ok'; serialNumber: string; unitId: string; at: Date }
  | { status: 'rejected'; serialNumber: string; reason: string; at: Date }
  | { status: 'undone'; serialNumber: string; at: Date };

const emptyModel = {
  name: '',
  category: '',
  brand: '',
  model: '',
  color: '',
  barcode: '',
  purchasePrice: '',
  salePrice: '',
  condition: 'new' as ProductCondition,
  accessories: '',
};

export default function ReceiveStockPage() {
  const queryClient = useQueryClient();
  const products = useProducts().data ?? [];
  const categories = useCategories().data ?? [];
  const reference = useReferenceCatalog().data ?? [];
  const addUnits = useAddUnits();
  const deleteUnit = useDeleteUnit();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [stockQuantity, setStockQuantity] = useState<number | null>(null);
  const isSending = addUnits.isPending;
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Création rapide d'un modèle
  const [createOpen, setCreateOpen] = useState(false);
  const [newModel, setNewModel] = useState(emptyModel);
  const [createError, setCreateError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Suggestions : catégories de la boutique + catalogue de référence commun (base globale)
  const categorySuggestions = useMemo(
    () => [...new Set([...categories.map((c) => c.name), ...reference.map((r) => r.name)])],
    [categories, reference]
  );
  const brandSuggestions = useMemo(() => {
    const ref = reference.find((r) => r.name.toLowerCase() === newModel.category.trim().toLowerCase());
    const shopBrands = products.map((p) => p.brand).filter((b): b is string => !!b);
    return [...new Set([...(ref?.brands || []), ...shopBrands])];
  }, [reference, products, newModel.category]);

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
      setNewModel({ ...emptyModel, barcode: code.trim() });
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
    sendSerials([code]);
  };

  const handlePaste = () => {
    const serials = pasteText.split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean);
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

  const createModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const parsed = NewModelSchema.safeParse(newModel);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const m = parsed.data;
    try {
      let category = categories.find((c) => c.name.toLowerCase() === m.category.toLowerCase());
      if (!category) category = (await api.post('/catalog/categories', { name: m.category })) as unknown as Category;
      const sku = [m.brand, m.name, m.model, m.color]
        .filter(Boolean)
        .join('-')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toUpperCase()
        .slice(0, 40);
      const product = (await api.post('/catalog/products', {
        name: m.name,
        sku: `${sku}-${Math.floor(100 + Math.random() * 900)}`,
        category: category.slug,
        brand: m.brand || undefined,
        model: m.model || undefined,
        color: m.color || undefined,
        barcode: m.barcode || undefined,
        condition: m.condition,
        accessories: m.accessories || undefined,
        purchasePrice: m.purchasePrice,
        salePrice: m.salePrice,
        hasSerialNumbers: true,
      })) as unknown as Product;
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setCreateOpen(false);
      setNewModel(emptyModel);
      selectProduct(product);
    } catch (err) {
      setCreateError(errorMessage(err));
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

        <div className="rounded-3xl border border-[#d4a017]/40 bg-neutral-950 p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Modèle en cours</p>
            <p className="text-lg font-bold text-white truncate">{selected.name}</p>
            {details && <p className="text-xs text-neutral-400 truncate">{details}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-black text-[#f5d77f]">
              +<NumberTicker value={added} />
            </p>
            <p className="text-[10px] text-neutral-500">ajouté(s) · {stockQuantity ?? '—'} en stock</p>
          </div>
        </div>

        <BarcodeScanner onScan={handleSerialScan} placeholder="Scannez le N° de série / IMEI de chaque appareil" />

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
              className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-3 text-sm font-mono text-white focus:outline-none focus:border-[#d4a017]"
            />
            <button
              onClick={handlePaste}
              className="w-full h-11 rounded-2xl bg-[#d4a017] text-black font-bold text-sm hover:brightness-110"
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
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-extrabold text-sm"
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
            <PackagePlus className="w-6 h-6 text-[#d4a017]" /> Mise en stock
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">1. Choisissez le modèle · 2. Scannez chaque appareil</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-3 py-2 rounded-xl bg-[#d4a017] text-black font-bold text-xs flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Nouveau modèle
        </button>
      </div>

      <BarcodeScanner onScan={handleModelScan} paused={createOpen} placeholder="Scannez le code-barres de la boîte (modèle)" />
      {message && <p className="text-xs text-amber-400">{message}</p>}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="…ou cherchez le modèle (nom, marque, couleur)"
          className="w-full h-11 pl-10 pr-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#d4a017]"
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
              className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-950 hover:border-[#d4a017] px-4 py-3 flex items-center justify-between gap-3 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={createModel}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-3 relative max-h-[90vh] overflow-y-auto"
          >
            <button type="button" onClick={() => setCreateOpen(false)} className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-white">Nouveau modèle</h2>
            <p className="text-xs text-neutral-400">Suivi par N° de série : le stock se remplit en scannant chaque appareil.</p>

            <Field label="Catégorie *">
              <input list="receive-categories" value={newModel.category} onChange={(e) => setNewModel({ ...newModel, category: e.target.value })} placeholder="Ex: Smartphones" className={inputCls} />
              <datalist id="receive-categories">
                {categorySuggestions.map((name) => <option key={name} value={name} />)}
              </datalist>
              <FieldError msg={errors.category} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marque">
                <input list="receive-brands" value={newModel.brand} onChange={(e) => setNewModel({ ...newModel, brand: e.target.value })} placeholder="Ex: Apple" className={inputCls} />
                <datalist id="receive-brands">
                  {brandSuggestions.map((b) => <option key={b} value={b} />)}
                </datalist>
              </Field>
              <Field label="Nom *">
                <input value={newModel.name} onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} placeholder="Ex: iPhone 15 Pro" className={inputCls} />
                <FieldError msg={errors.name} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Modèle / capacité">
                <input value={newModel.model} onChange={(e) => setNewModel({ ...newModel, model: e.target.value })} placeholder="Ex: 256 Go" className={inputCls} />
              </Field>
              <Field label="Couleur">
                <input value={newModel.color} onChange={(e) => setNewModel({ ...newModel, color: e.target.value })} placeholder="Ex: Titane naturel" className={inputCls} />
              </Field>
            </div>
            <Field label="Code-barres de la boîte (EAN)">
              <input value={newModel.barcode} onChange={(e) => setNewModel({ ...newModel, barcode: e.target.value })} placeholder="Facultatif" className={`${inputCls} font-mono`} />
              <FieldError msg={errors.barcode} />
            </Field>
            <Field label="État (imprimé sur le contrat du client)">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={newModel.condition === k}
                    onClick={() => setNewModel({ ...newModel, condition: k })}
                    className={`h-10 rounded-xl border text-xs font-semibold ${
                      newModel.condition === k ? 'bg-[#d4a017]/15 border-[#d4a017] text-[#f5d77f]' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {CONDITION_LABELS[k]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Accessoires fournis">
              <input value={newModel.accessories} onChange={(e) => setNewModel({ ...newModel, accessories: e.target.value })} placeholder="Ex: Chargeur, câble, boîte" maxLength={300} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prix d'achat">
                <input type="number" min={0} value={newModel.purchasePrice} onChange={(e) => setNewModel({ ...newModel, purchasePrice: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Prix de vente">
                <input type="number" min={0} value={newModel.salePrice} onChange={(e) => setNewModel({ ...newModel, salePrice: e.target.value })} className={inputCls} />
              </Field>
            </div>

            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <button type="submit" className="w-full h-12 rounded-2xl bg-[#d4a017] text-black font-bold text-sm hover:brightness-110">
              Créer et commencer à scanner
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-[#d4a017]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-400 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <span className="block text-[11px] text-red-400 mt-1">{msg}</span> : null;
}
