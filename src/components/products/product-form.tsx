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
  Flag,
  X,
  Camera,
  ImageOff,
  Globe2,
  ScanLine,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useBrands, useCategories, useDeviceCatalog, useProducts, useReferenceCatalog, type CategoryProfile, type DeviceModel } from '@/lib/queries';
import { CONDITION_LABELS, type ProductCondition } from '@/lib/contract';
import { DeviceSpecs } from '@/components/products/device-specs';
import { errorMessage, type Category, type Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { reportImage, useSharedImages } from '@/lib/images';
import { useAuth } from '@/contexts/auth-context';
import { ProductVisual } from './product-visual';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
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
  // Stock à jour en direct (mises en stock faites ailleurs pendant que la fiche est ouverte)
  const liveStock = products.find((p) => p._id === initial?._id)?.stockQuantity ?? initial?.stockQuantity ?? 0;

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
  const [chosenImage, setChosenImage] = useState<string | null>(initial?.imageId || null);
  /** L'utilisateur a choisi lui-même (photo ou « sans photo ») : plus de choix automatique */
  const [imageTouched, setImageTouched] = useState(!!initial);
  /** Photo prise / choisie sur l'appareil : réduite tout de suite, envoyée seulement à l'enregistrement */
  const { establishment } = useAuth();
  const [reported, setReported] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Scan du code-barres de la boîte à la caméra (ou douchette) */
  const [scanOpen, setScanOpen] = useState(false);
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

  // Photos partagées par toutes les boutiques pour ce modèle (la bonne couleur d'abord)
  const shared = useSharedImages({ brand, model: effectiveName, color, category: slug });
  const sharedImages = shared.data ?? [];
  // Tant que l'utilisateur n'a rien choisi : la meilleure photo partagée de ce modèle
  const imageId = imageTouched ? chosenImage : sharedImages[0]?.id ?? null;
  const setImageId = (id: string | null) => {
    setChosenImage(id);
    setImageTouched(true);
  };

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
  // Prix pratiqué par les autres boutiques (même devise ; la bonne capacité d'abord) : un repère, jamais imposé
  const variantKey = variant.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const localPrices = (knownModel?.prices || []).filter((x) => establishment?.currencyCode && x.currency === establishment.currencyCode);
  const marketPrice = (variantKey && localPrices.find((x) => x.variantKey === variantKey)) || localPrices.find((x) => !x.variantKey) || null;
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
      // La photo prise sur l'appareil n'est envoyée que maintenant, au clic sur « Enregistrer »
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
        // Photo et fiche technique viennent du catalogue global ZAFF
        imageId: imageId || (initial?.imageId ? null : undefined),
        deviceId: knownModel?.id || undefined,
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
      await queryClient.invalidateQueries({ queryKey: ['images'] });
      onSaved(saved);
    } catch (err) {
      // Produit non enregistré : la photo tout juste envoyée est annulée (aucun fichier orphelin)
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
        <div className="rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 flex items-center gap-3">
          <ProductVisual imageId={imageId} size="thumb" category={slug} brand={brand} name={fullDesignation} className="w-12 h-12 shrink-0" rounded="rounded-xl" />
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
              <button type="button" onClick={() => onUseExisting(duplicate)} className="block mt-1.5 font-bold text-gold-soft underline">
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
                  on ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
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
          hint={
            brand && model.trim() && !knownModel
              ? 'Modèle absent du catalogue ZAFF : enregistrez-le quand même, ZAFF est prévenu et ajoutera sa photo et sa fiche technique.'
              : brand && !modelOptions.length
                ? `Aucun modèle ${brand} connu : tapez son nom, il sera mémorisé pour la boutique.`
                : undefined
          }
        />
        <Err msg={errors.name} />
        {knownModel?.specs?.length ? <DeviceSpecs specs={knownModel.specs} title="Fiche technique ZAFF" /> : null}
      </Section>

      {/* 3. Version */}
      <Section n={3} title="Version" done={!!variant || !!color} locked={!category} lockedText="Choisissez d'abord le type d'appareil.">
        <Picker label={profile?.variantLabel || 'Capacité / variante'} icon={HardDrive} value={variant} onChange={setVariant} options={variantOptions} placeholder={`Ex. : ${variantOptions[0] || '256 Go'}`} max={10} />
        <Picker label="Couleur" icon={Palette} value={color} onChange={setColor} options={colorOptions} placeholder={`Ex. : ${colorOptions[0] || 'Noir'}`} max={12} />
      </Section>

      {/* 4. Photo (base partagée par toutes les boutiques) */}
      <Section
        n={4}
        title="Photo"
        subtitle="Photos officielles du catalogue ZAFF : rien à photographier"
        done={!!imageId}
        locked={!brand || !effectiveName}
        lockedText="Choisissez la marque et le modèle pour voir les photos disponibles."
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {sharedImages.map((img) => {
            const on = imageId === img.id;
            const fromOtherShop = img.establishmentName !== establishment?.name;
            return (
              <div
                key={img.id}
                title={img.color || 'Tous coloris'}
                className={cn('relative aspect-square rounded-2xl border-2 overflow-hidden transition-colors', on ? 'border-gold' : 'border-neutral-800 hover:border-neutral-600')}
              >
                <button type="button" onClick={() => setImageId(img.id)} aria-pressed={on} className="absolute inset-0" aria-label={`Utiliser la photo ${img.color || img.model}`}>
                  <ProductVisual imageId={img.id} size="thumb" className="absolute inset-0" rounded="rounded-none" name={img.model} />
                </button>
                {img.color && <span className="pointer-events-none absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/60 px-1 text-[9px] font-semibold text-white theme-fixed">{img.color}</span>}
                {on && (
                  <span className="pointer-events-none absolute top-1 right-1 w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                    <Check className="w-3 h-3 text-ink" />
                  </span>
                )}
                {fromOtherShop && (
                  <button
                    type="button"
                    disabled={!!reported[img.id]}
                    onClick={async () => {
                      if (!window.confirm('Signaler cette photo (inadaptée ou mauvais modèle) ? Après 3 signalements, elle ne sera plus proposée.')) return;
                      try {
                        const r = await reportImage(img.id);
                        setReported((m) => ({ ...m, [img.id]: r.hidden ? 'Masquée' : 'Signalée' }));
                        if (on) setImageId(null);
                      } catch (err) {
                        setImageError(errorMessage(err));
                      }
                    }}
                    className="theme-fixed absolute top-1 left-1 h-5 px-1.5 rounded-full bg-black/60 text-white text-[9px] font-semibold flex items-center gap-0.5 disabled:opacity-80"
                    aria-label="Signaler la photo"
                  >
                    <Flag className="w-2.5 h-2.5" /> {reported[img.id] || ''}
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setImageId(null);
              setImageTouched(true);
            }}
            aria-pressed={!imageId}
            className={cn(
              'aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold',
              !imageId ? 'border-gold text-gold-soft' : 'border-neutral-800 text-neutral-500 hover:border-neutral-600'
            )}
          >
            <ImageOff className="w-6 h-6" /> Sans photo
          </button>
        </div>
        <p className="text-[11px] text-neutral-500 flex items-start gap-1.5">
          <Globe2 className="w-3.5 h-3.5 shrink-0 mt-px text-gold" />
          {shared.isLoading
            ? 'Recherche des photos de ce modèle…'
            : sharedImages.length
              ? `${sharedImages.length} photo${sharedImages.length > 1 ? 's' : ''} disponible${sharedImages.length > 1 ? 's' : ''} pour ce modèle. Sans photo, une illustration colorée est affichée.`
              : 'Photo pas encore disponible pour ce modèle : ZAFF ajoute les photos au catalogue, elle apparaîtra automatiquement. En attendant, une illustration colorée est affichée.'}
        </p>
        {imageError && <p className="text-xs text-red-400">{imageError}</p>}
      </Section>

      {/* 4. Désignation et codes */}
      <Section n={5} title="Désignation et codes" done={!!effectiveName} invalid={!!errors.sku || !!errors.barcode}>
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
              <button type="button" onClick={() => setNameTouched(false)} className="text-[11px] text-gold flex items-center gap-1">
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
          <TextField
            label="Code-barres de la boîte"
            value={barcode}
            onChange={setBarcode}
            placeholder="Tapez ou scannez"
            mono
            icon={Barcode}
            error={errors.barcode}
            inputMode="numeric"
            action={
              <button type="button" onClick={() => setScanOpen(true)} className="text-[11px] text-gold flex items-center gap-1">
                <Camera className="w-3 h-3" /> Scanner
              </button>
            }
          />
        </div>
      </Section>

      {/* 5. État et accessoires */}
      <Section n={6} title="État et accessoires" done subtitle="Imprimés sur le contrat de garantie du client">
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
      <Section n={7} title="Prix" done={sale > 0} invalid={!!errors.salePrice}>
        <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
          <MoneyField label="Prix d'achat" value={purchasePrice} onChange={setPurchasePrice} />
          <MoneyField label="Prix de vente *" value={salePrice} onChange={(v) => { setSalePrice(v); setErrors((e) => ({ ...e, salePrice: '' })); }} error={errors.salePrice} />
          {!compact && <MoneyField label="Prix revendeur" value={resellerPrice} onChange={setResellerPrice} />}
        </div>
        {marketPrice && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-neutral-300">
              <Globe2 className="inline w-3.5 h-3.5 mr-1 text-gold" />
              Prix pratiqué{marketPrice.variant ? ` (${marketPrice.variant})` : ''} : <strong className="text-white">~{marketPrice.median.toLocaleString('fr-FR')} {establishment?.currency}</strong>
              <span className="text-neutral-500"> · médiane de {marketPrice.shops} boutiques ZAFF</span>
            </p>
            {Number(salePrice) !== marketPrice.median && (
              <button type="button" onClick={() => (setSalePrice(String(marketPrice.median)), setErrors((e) => ({ ...e, salePrice: '' })))} className="h-8 px-3 rounded-lg border border-gold/50 text-gold-soft text-xs font-semibold">
                Utiliser ce prix
              </button>
            )}
          </div>
        )}
        {margin !== null && (
          <p className={cn('text-xs flex items-center gap-1.5', margin >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            <Banknote className="w-3.5 h-3.5" />
            {margin >= 0 ? 'Marge' : 'Perte'} : {Math.abs(margin).toLocaleString('fr-FR')} ({cost ? Math.round((margin / cost) * 100) : 0} %)
          </p>
        )}
      </Section>

      {/* 7. Stock */}
      {!compact && (
        <Section n={8} title="Stock" done>
          <label className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-3 cursor-pointer">
            <input type="checkbox" checked={hasSerialNumbers} onChange={(e) => setHasSerialNumbers(e.target.checked)} className="mt-0.5 w-4 h-4 accent-gold" />
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
                  <Boxes className="w-4 h-4" /> <strong className="text-white text-sm">{liveStock}</strong> en stock
                </p>
              </div>
            ) : (
              <TextField label="Stock actuel" value={stockQuantity} onChange={setStockQuantity} inputMode="numeric" />
            )}
            <TextField label="Alerte stock bas à" value={minStockAlert} onChange={setMinStockAlert} inputMode="numeric" />
          </div>
          {hasSerialNumbers && (
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3 space-y-2">
              <p className="text-xs text-neutral-300">
                Le stock monte en scannant le <strong className="text-white">N° de série / IMEI de chaque appareil</strong> (étiquette de la boîte ou
                *#06# sur un téléphone). Le code-barres de la boîte sert seulement à reconnaître le modèle.
              </p>
              {initial?._id ? (
                <Link
                  href={`/app/receive?product=${initial._id}`}
                  className="h-11 px-4 rounded-xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold inline-flex items-center gap-2"
                >
                  <ScanLine className="w-4 h-4" /> Scanner les appareils
                </Link>
              ) : (
                <p className="text-[11px] text-gold-soft">Après « Créer le produit », l&apos;écran de scan s&apos;ouvre : chaque appareil scanné ajoute 1 au stock.</p>
              )}
            </div>
          )}
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
          className="flex-1 sm:flex-none px-6 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
          {initial ? 'Enregistrer' : compact ? 'Créer et scanner les appareils' : 'Créer le produit'}
        </button>
      </div>
      {scanOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={() => setScanOpen(false)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-neutral-950 border border-neutral-800 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Code-barres de la boîte</p>
              <button type="button" onClick={() => setScanOpen(false)} className="p-1 text-neutral-400 hover:text-white" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">Ce code identifie le modèle (il n&apos;ajoute pas de stock).</p>
            <BarcodeScanner
              autoStartCamera
              placeholder="Scannez ou tapez le code-barres"
              onScan={(code) => {
                setBarcode(code.trim());
                setErrors((e) => ({ ...e, barcode: '' }));
                setScanOpen(false);
              }}
            />
          </div>
        </div>
      )}
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
        invalid ? 'border-red-500/50' : active ? 'border-gold/50 bg-gold/[0.03]' : 'border-neutral-800'
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0',
            done && !locked ? 'bg-gold text-ink' : 'bg-neutral-800 text-neutral-400'
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
        on ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
      )}
    >
      {children}
    </button>
  );
}

const inputCls = 'w-full h-11 px-3 rounded-xl bg-neutral-900 border text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-gold';

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
          <Icon className="w-3.5 h-3.5 text-gold" /> {label}
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
          className="w-full h-11 px-3 rounded-xl bg-gold/10 border border-gold text-sm font-semibold text-gold-soft flex items-center justify-between"
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
                <button type="button" onClick={() => setAll(!all)} className="h-9 px-2 text-xs text-gold">
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
