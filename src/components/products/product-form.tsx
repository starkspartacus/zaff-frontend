'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Barcode,
  Boxes,
  Check,
  ChevronDown,
  Cpu,
  Gamepad2,
  HardDrive,
  Headphones,
  Laptop,
  Monitor,
  Package,
  Palette,
  Plus,
  Printer,
  Router,
  Smartphone,
  Sparkles,
  Tablet,
  Tag,
  Watch,
  Cable,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useBrands, useCategories, useDeviceCatalog, useProducts, useReferenceCatalog, type CategoryProfile, type DeviceModel } from '@/lib/queries';
import { CONDITION_LABELS, type ProductCondition } from '@/lib/contract';
import { errorMessage, type Category, type Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { fieldErrors, ProductFormSchema } from '@/lib/schemas';

/**
 * Fiche produit en sections, pensée pour aller vite : on choisit la catégorie, puis la marque, le modèle,
 * la capacité et la couleur parmi les appareils connus (catalogue ZAFF + produits déjà créés par la boutique).
 * Tout reste modifiable à la main : une valeur absente des listes se tape simplement.
 */

const ICONS: Record<string, React.ElementType> = {
  smartphone: Smartphone,
  laptop: Laptop,
  monitor: Monitor,
  tablet: Tablet,
  printer: Printer,
  watch: Watch,
  headphones: Headphones,
  router: Router,
  'hard-drive': HardDrive,
  cpu: Cpu,
  cable: Cable,
  gamepad: Gamepad2,
};

/** Gammes déjà connues sans le nom de la marque : « iPhone 15 » et pas « Apple iPhone 15 » */
const NO_BRAND_PREFIX = /^(iphone|ipad|imac|mac|macbook|airpods|apple|pixel|playstation|xbox|surface|switch|redmi|poco|manette)/i;

const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const uniq = (list: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const t = v?.trim();
    if (t && !seen.has(norm(t))) {
      seen.add(norm(t));
      out.push(t);
    }
  }
  return out;
};

export function autoName(brand: string, model: string) {
  const m = model.trim();
  const b = brand.trim();
  if (!m) return '';
  if (!b || NO_BRAND_PREFIX.test(m) || norm(m).startsWith(norm(b))) return m;
  return `${b} ${m}`;
}

function autoSku(parts: string[]) {
  const base = parts
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
    .slice(0, 36);
  return base || 'ART';
}

const ACC_SEP = /\s*,\s*/;

export interface ProductFormProps {
  /** Produit à modifier (sinon création) */
  initial?: Product | null;
  /** Mise en stock : produit suivi par N° de série, sans stock manuel ni prix revendeur */
  compact?: boolean;
  /** Valeurs de départ (ex. code-barres scanné) */
  defaults?: Partial<{ barcode: string; category: string }>;
  onSaved: (product: Product) => void;
  onCancel: () => void;
  /** Produit existant identique : le reprendre plutôt qu'en créer un doublon */
  onUseExisting?: (product: Product) => void;
}

export function ProductForm({ initial, compact, defaults, onSaved, onCancel, onUseExisting }: ProductFormProps) {
  const queryClient = useQueryClient();
  const reference = useReferenceCatalog().data ?? [];
  const devices = useDeviceCatalog().data;
  const shopCategories = useCategories().data ?? [];
  const shopBrands = useBrands().data ?? [];
  const products = useProducts().data ?? [];

  const initialCategoryName =
    (initial && (shopCategories.find((c) => c.slug === initial.category)?.name || reference.find((r) => r.slug === initial.category)?.name || initial.category)) ||
    defaults?.category ||
    '';

  const [category, setCategory] = useState(initialCategoryName);
  const [brand, setBrand] = useState(initial?.brand || '');
  const [model, setModel] = useState(initial ? initial.name : '');
  const [variant, setVariant] = useState(initial?.model || '');
  const [color, setColor] = useState(initial?.color || '');
  const [name, setName] = useState(initial?.name || '');
  const [nameTouched, setNameTouched] = useState(!!initial);
  const [sku, setSku] = useState(initial?.sku || '');
  const [skuTouched, setSkuTouched] = useState(!!initial);
  const [skuSuffix] = useState(() => String(Math.floor(100 + Math.random() * 900)));
  const [barcode, setBarcode] = useState(initial?.barcode || defaults?.barcode || '');
  const [condition, setCondition] = useState<ProductCondition>(initial?.condition || 'new');
  const [accessories, setAccessories] = useState<string[]>(initial?.accessories ? initial.accessories.split(ACC_SEP).filter(Boolean) : []);
  const [purchasePrice, setPurchasePrice] = useState(initial?.purchasePrice ? String(initial.purchasePrice) : '');
  const [salePrice, setSalePrice] = useState(initial?.salePrice ? String(initial.salePrice) : '');
  const [resellerPrice, setResellerPrice] = useState(initial?.resellerPrice ? String(initial.resellerPrice) : '');
  const [hasSerialNumbers, setHasSerialNumbers] = useState(compact ? true : initial ? !!initial.hasSerialNumbers : true);
  const [stockQuantity, setStockQuantity] = useState(String(initial?.stockQuantity ?? 0));
  const [minStockAlert, setMinStockAlert] = useState(String(initial?.minStockAlert ?? 3));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Données dérivées ───
  const refCat = reference.find((r) => norm(r.name) === norm(category));
  const shopCat = shopCategories.find((c) => norm(c.name) === norm(category));
  const slug = refCat?.slug || shopCat?.slug || '';
  const profile: CategoryProfile | undefined = devices ? devices.profiles[slug] || devices.defaultProfile : undefined;
  const brandModels = devices?.models[slug] || {};
  const known = Object.entries(brandModels).find(([b]) => norm(b) === norm(brand))?.[1] || [];
  const knownModel: DeviceModel | undefined = known.find((x) => norm(x.name) === norm(model));
  const sameCategory = products.filter((p) => (slug ? p.category === slug : false));
  const sameModel = products.filter((p) => norm(p.name) === norm(name || autoName(brand, model)));

  const categoryOptions = uniq([...reference.map((r) => r.name), ...shopCategories.map((c: Category) => c.name)]);
  const brandOptions = uniq([...(refCat?.brands || []), ...Object.keys(brandModels), ...sameCategory.map((p) => p.brand), ...(slug ? [] : shopBrands.map((b) => b.name))]);
  const modelOptions = uniq([
    ...known.map((x) => x.name),
    ...sameCategory.filter((p) => norm(p.brand || '') === norm(brand)).map((p) => p.name),
  ]);
  const variantOptions = uniq([...(knownModel?.variants || profile?.variants || []), ...sameModel.map((p) => p.model)]);
  const colorOptions = uniq([...(knownModel?.colors || profile?.colors || []), ...sameModel.map((p) => p.color)]);
  const accessoryOptions = uniq([...(profile?.accessories || []), ...accessories]);

  const effectiveName = nameTouched ? name : autoName(brand, model);
  const effectiveSku = skuTouched ? sku : `${autoSku([brand, model, variant, color])}-${skuSuffix}`;
  const fullDesignation = [effectiveName, variant, color].filter(Boolean).join(' · ');

  const duplicate = !initial
    ? products.find(
        (p) =>
          norm(p.name) === norm(effectiveName) &&
          norm(p.model || '') === norm(variant) &&
          norm(p.color || '') === norm(color) &&
          !!effectiveName,
      )
    : undefined;

  const sale = Number(salePrice) || 0;
  const cost = Number(purchasePrice) || 0;
  const margin = sale && cost ? sale - cost : null;

  const pickCategory = (v: string) => {
    setCategory(v);
    setErrors((e) => ({ ...e, category: '' }));
    const r = reference.find((x) => norm(x.name) === norm(v));
    if (!initial && !compact && r) setHasSerialNumbers(r.serialTracked);
    if (norm(v) !== norm(category)) {
      setBrand('');
      setModel('');
      setVariant('');
      setColor('');
    }
  };
  const pickBrand = (v: string) => {
    if (norm(v) !== norm(brand)) {
      setModel('');
      setVariant('');
      setColor('');
    }
    setBrand(v);
  };
  const pickModel = (v: string) => {
    if (norm(v) !== norm(model)) {
      setVariant('');
      setColor('');
    }
    setModel(v);
    setErrors((e) => ({ ...e, name: '' }));
  };

  const validate = () => {
    const parsed = ProductFormSchema.safeParse({ category, name: effectiveName, sku: effectiveSku, barcode, salePrice: sale });
    return parsed.success ? {} : fieldErrors(parsed.error);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Catégorie / marque : réutilise l'existante de la boutique ou la crée
      let cat = shopCat;
      if (!cat) cat = (await api.post('/catalog/categories', { name: category.trim() })) as unknown as Category;
      let brandDoc = brand.trim() ? shopBrands.find((b) => norm(b.name) === norm(brand)) : undefined;
      if (brand.trim() && !brandDoc) {
        brandDoc = (await api.post('/catalog/brands', { name: brand.trim(), categoryId: cat._id })) as unknown as { _id: string; name: string };
      }
      const payload = {
        name: effectiveName.trim(),
        sku: effectiveSku.trim(),
        barcode: barcode.trim() || undefined,
        category: cat.slug,
        brand: brandDoc?.name || undefined,
        brandId: brandDoc?._id || undefined,
        model: variant.trim() || undefined,
        color: color.trim() || undefined,
        condition,
        accessories: accessories.join(', ') || undefined,
        purchasePrice: cost,
        salePrice: sale,
        resellerPrice: Number(resellerPrice) || 0,
        // Produit à N° de série : le stock vient uniquement des appareils scannés
        stockQuantity: hasSerialNumbers ? undefined : Number(stockQuantity) || 0,
        minStockAlert: Number(minStockAlert) || 0,
        hasSerialNumbers,
      };
      const saved = (initial
        ? await api.put(`/catalog/products/${initial._id}`, payload)
        : await api.post('/catalog/products', payload)) as unknown as Product;
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      onSaved(saved);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const step = !category ? 1 : !model && !nameTouched ? 2 : 3;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {/* Aperçu vivant de la fiche */}
      <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 bg-neutral-950">
        <div className="rounded-2xl border border-[#d4a017]/30 bg-[#d4a017]/5 px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d4a017]/15 flex items-center justify-center shrink-0">
            <CategoryIcon icon={refCat?.icon} className="w-5 h-5 text-[#f5d77f]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-bold truncate', fullDesignation ? 'text-white' : 'text-neutral-500')}>
              {fullDesignation || 'Votre produit apparaîtra ici'}
            </p>
            <p className="text-[11px] text-neutral-500 truncate">
              {[category, brand, CONDITION_LABELS[condition], sale ? `${sale.toLocaleString('fr-FR')}` : null].filter(Boolean).join(' · ') || 'Choisissez le type d\'appareil pour commencer'}
            </p>
          </div>
        </div>
      </div>

      {duplicate && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            Ce produit existe déjà : <strong>{[duplicate.name, duplicate.model, duplicate.color].filter(Boolean).join(' · ')}</strong> ({duplicate.stockQuantity} en stock).
            {onUseExisting && (
              <button type="button" onClick={() => onUseExisting(duplicate)} className="block mt-1.5 font-bold text-[#f5d77f] underline">
                Utiliser ce produit
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. Type d'appareil */}
      <Section n={1} title="Type d'appareil" done={!!category} active={step === 1} invalid={!!errors.category}>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {reference.map((r) => {
            const on = norm(r.name) === norm(category);
            return (
              <button
                key={r.slug}
                type="button"
                onClick={() => pickCategory(r.name)}
                aria-pressed={on}
                className={cn(
                  'h-[4.5rem] rounded-2xl border px-1 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold leading-tight text-center transition-colors',
                  on ? 'bg-[#d4a017]/15 border-[#d4a017] text-[#f5d77f]' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
                )}
              >
                <CategoryIcon icon={r.icon} className="w-5 h-5" />
                {r.name}
              </button>
            );
          })}
        </div>
        <FreeInput
          value={reference.some((r) => norm(r.name) === norm(category)) ? '' : category}
          onChange={pickCategory}
          placeholder="Autre catégorie (ex. : Drones)"
          options={categoryOptions.filter((c) => !reference.some((r) => norm(r.name) === norm(c)))}
        />
        <Err msg={errors.category} />
      </Section>

      {/* 2. Marque et modèle */}
      <Section n={2} title="Marque et modèle" done={!!model || nameTouched} active={step === 2} locked={!category} lockedText="Choisissez d'abord le type d'appareil." invalid={!!errors.name}>
        <Picker label="Marque" icon={Tag} value={brand} onChange={pickBrand} options={brandOptions} placeholder="Ex. : Samsung" max={14} />
        <Picker
          label="Modèle"
          icon={Sparkles}
          value={model}
          onChange={pickModel}
          options={modelOptions}
          placeholder={brand ? `Ex. : ${modelOptions[0] || 'nom du modèle'}` : 'Choisissez la marque ou tapez le modèle'}
          max={12}
          hint={brand && !modelOptions.length ? `Aucun modèle ${brand} connu : tapez son nom, il sera mémorisé pour la boutique.` : undefined}
        />
        <Err msg={errors.name} />
      </Section>

      {/* 3. Version */}
      <Section n={3} title="Version" done={!!variant || !!color} locked={!category} lockedText="Choisissez d'abord le type d'appareil.">
        <Picker label={profile?.variantLabel || 'Capacité / variante'} icon={HardDrive} value={variant} onChange={setVariant} options={variantOptions} placeholder={`Ex. : ${variantOptions[0] || '256 Go'}`} max={10} />
        <Picker label="Couleur" icon={Palette} value={color} onChange={setColor} options={colorOptions} placeholder={`Ex. : ${colorOptions[0] || 'Noir'}`} max={12} />
      </Section>

      {/* 4. Désignation et codes */}
      <Section n={4} title="Désignation et codes" done={!!effectiveName} invalid={!!errors.sku || !!errors.barcode}>
        <TextField
          label="Désignation"
          value={effectiveName}
          onChange={(v) => {
            setName(v);
            setNameTouched(true);
          }}
          placeholder="Remplie automatiquement"
          action={
            nameTouched && !initial ? (
              <button type="button" onClick={() => setNameTouched(false)} className="text-[11px] text-[#d4a017] flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> Automatique
              </button>
            ) : null
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Référence (SKU)"
            value={effectiveSku}
            onChange={(v) => {
              setSku(v.toUpperCase());
              setSkuTouched(true);
            }}
            mono
            error={errors.sku}
          />
          <TextField label="Code-barres de la boîte" value={barcode} onChange={setBarcode} placeholder="Scan ou saisie" mono icon={Barcode} error={errors.barcode} inputMode="numeric" />
        </div>
      </Section>

      {/* 5. État et accessoires */}
      <Section n={5} title="État et accessoires" done subtitle="Imprimés sur le contrat de garantie du client">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((k) => (
            <Chip key={k} on={condition === k} onClick={() => setCondition(k)} big>
              {CONDITION_LABELS[k]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {accessoryOptions.map((a) => {
            const on = accessories.some((x) => norm(x) === norm(a));
            return (
              <Chip key={a} on={on} onClick={() => setAccessories(on ? accessories.filter((x) => norm(x) !== norm(a)) : [...accessories, a])}>
                {on && <Check className="w-3 h-3" />} {a}
              </Chip>
            );
          })}
        </div>
        <AddInline placeholder="Autre accessoire" onAdd={(v) => !accessories.some((x) => norm(x) === norm(v)) && setAccessories([...accessories, v])} />
      </Section>

      {/* 6. Prix */}
      <Section n={6} title="Prix" done={sale > 0} invalid={!!errors.salePrice}>
        <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
          <MoneyField label="Prix d'achat" value={purchasePrice} onChange={setPurchasePrice} />
          <MoneyField label="Prix de vente *" value={salePrice} onChange={(v) => { setSalePrice(v); setErrors((e) => ({ ...e, salePrice: '' })); }} error={errors.salePrice} />
          {!compact && <MoneyField label="Prix revendeur" value={resellerPrice} onChange={setResellerPrice} />}
        </div>
        {margin !== null && (
          <p className={cn('text-xs flex items-center gap-1.5', margin >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            <Banknote className="w-3.5 h-3.5" />
            {margin >= 0 ? 'Marge' : 'Perte'} : {Math.abs(margin).toLocaleString('fr-FR')} ({cost ? Math.round((margin / cost) * 100) : 0} %)
          </p>
        )}
      </Section>

      {/* 7. Stock */}
      {!compact && (
        <Section n={7} title="Stock" done>
          <label className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-3 cursor-pointer">
            <input type="checkbox" checked={hasSerialNumbers} onChange={(e) => setHasSerialNumbers(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#d4a017]" />
            <span className="text-xs text-neutral-300">
              <strong className="text-white">Suivi par N° de série / IMEI</strong> — chaque appareil est scanné à la mise en stock et à la vente
              {refCat && <span className="block text-neutral-500 mt-0.5">{refCat.serialTracked ? 'Recommandé pour cette catégorie.' : 'Facultatif pour cette catégorie (accessoires, consommables).'}</span>}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {hasSerialNumbers ? (
              <div>
                <p className="text-xs font-semibold text-neutral-300 mb-1">Stock</p>
                <p className="h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 flex items-center gap-2">
                  <Boxes className="w-4 h-4" /> {initial?.stockQuantity ?? 0} · alimenté par scan
                </p>
              </div>
            ) : (
              <TextField label="Stock actuel" value={stockQuantity} onChange={setStockQuantity} inputMode="numeric" />
            )}
            <TextField label="Alerte stock bas à" value={minStockAlert} onChange={setMinStockAlert} inputMode="numeric" />
          </div>
        </Section>
      )}

      {saveError && <p className="rounded-xl bg-red-950/40 border border-red-800/50 p-3 text-xs text-red-200">{saveError}</p>}

      <div className="sticky bottom-0 -mx-1 px-1 pt-3 pb-1 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 h-12 rounded-2xl text-sm text-neutral-400 hover:text-white">
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 sm:flex-none px-6 h-12 rounded-2xl bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
          {initial ? 'Enregistrer' : compact ? 'Créer et scanner les appareils' : 'Créer le produit'}
        </button>
      </div>
    </form>
  );
}

// ─── Briques ───

function CategoryIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Package;
  return <Icon className={className} />;
}

function Section({
  n,
  title,
  subtitle,
  done,
  active,
  locked,
  lockedText,
  invalid,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  done?: boolean;
  active?: boolean;
  locked?: boolean;
  lockedText?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      data-invalid={invalid ? 'true' : undefined}
      className={cn(
        'rounded-3xl border p-4 space-y-3 transition-colors',
        invalid ? 'border-red-500/50' : active ? 'border-[#d4a017]/50 bg-[#d4a017]/[0.03]' : 'border-neutral-800'
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0',
            done && !locked ? 'bg-[#d4a017] text-black' : 'bg-neutral-800 text-neutral-400'
          )}
        >
          {done && !locked ? <Check className="w-3.5 h-3.5" /> : n}
        </span>
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {locked ? <p className="text-xs text-neutral-500 pl-8">{lockedText}</p> : children}
    </section>
  );
}

function Chip({ on, onClick, children, big }: { on: boolean; onClick: () => void; children: React.ReactNode; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'rounded-xl border font-semibold flex items-center justify-center gap-1 transition-colors',
        big ? 'h-11 text-xs' : 'h-9 px-3 text-xs',
        on ? 'bg-[#d4a017]/15 border-[#d4a017] text-[#f5d77f]' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
      )}
    >
      {children}
    </button>
  );
}

const inputCls = 'w-full h-11 px-3 rounded-xl bg-neutral-900 border text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#d4a017]';

/**
 * Choix dans une liste de suggestions (pastilles) ou saisie libre : taper filtre les pastilles,
 * et une valeur inconnue est gardée telle quelle.
 */
function Picker({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
  max,
  hint,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  max: number;
  hint?: string;
}) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const typed = query.trim();
  const filtered = useMemo(() => (typed ? options.filter((o) => norm(o).includes(norm(typed))) : options), [options, typed]);
  const shown = all ? filtered : filtered.slice(0, max);
  const isNew = !!typed && !options.some((o) => norm(o) === norm(typed));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-[#d4a017]" /> {label}
        </p>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-[11px] text-neutral-500 hover:text-white">
            Effacer
          </button>
        )}
      </div>
      {value ? (
        <button
          type="button"
          onClick={() => {
            setQuery(value);
            onChange('');
          }}
          className="w-full h-11 px-3 rounded-xl bg-[#d4a017]/10 border border-[#d4a017] text-sm font-semibold text-[#f5d77f] flex items-center justify-between"
          title="Changer"
        >
          {value}
          <ChevronDown className="w-4 h-4" />
        </button>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && typed) {
                e.preventDefault();
                onChange(filtered.length === 1 && !isNew ? filtered[0] : typed);
                setQuery('');
              }
            }}
            placeholder={placeholder}
            className={cn(inputCls, 'border-neutral-800')}
          />
          <div className="flex flex-wrap gap-1.5">
              {isNew && (
                <Chip
                  on={false}
                  onClick={() => {
                    onChange(typed);
                    setQuery('');
                  }}
                >
                  <Plus className="w-3 h-3" /> Ajouter « {typed} »
                </Chip>
              )}
              {shown.map((o) => (
                <Chip
                  key={o}
                  on={false}
                  onClick={() => {
                    onChange(o);
                    setQuery('');
                  }}
                >
                  {o}
                </Chip>
              ))}
              {filtered.length > max && (
                <button type="button" onClick={() => setAll(!all)} className="h-9 px-2 text-xs text-[#d4a017]">
                  {all ? 'Moins' : `+ ${filtered.length - max} autres`}
                </button>
              )}
          </div>
          {hint && <p className="text-[11px] text-neutral-500">{hint}</p>}
        </>
      )}
    </div>
  );
}

function FreeInput({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <>
      <input list="product-form-categories" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputCls, 'border-neutral-800')} />
      <datalist id="product-form-categories">
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

function AddInline({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  const add = () => {
    if (v.trim()) onAdd(v.trim());
    setV('');
  };
  return (
    <div className="flex gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        placeholder={placeholder}
        maxLength={60}
        className={cn(inputCls, 'border-neutral-800 h-10')}
      />
      <button type="button" onClick={add} className="h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1 shrink-0">
        <Plus className="w-4 h-4" /> Ajouter
      </button>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  error,
  icon: Icon,
  inputMode,
  action,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  error?: string;
  icon?: React.ElementType;
  inputMode?: 'numeric' | 'text';
  action?: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between text-xs font-semibold text-neutral-300">
        {label}
        {action}
      </span>
      <span className="relative block">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className={cn(inputCls, mono && 'font-mono', Icon && 'pl-9', error ? 'border-red-500/60' : 'border-neutral-800')}
        />
      </span>
      <Err msg={error} />
    </label>
  );
}

function MoneyField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-neutral-300">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={cn(inputCls, 'font-semibold', error ? 'border-red-500/60' : 'border-neutral-800')}
      />
      <Err msg={error} />
    </label>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-red-400">{msg}</p> : null;
}
