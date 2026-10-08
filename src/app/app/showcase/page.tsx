'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, PackageSearch, ScanLine, Search, ShoppingCart, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useCatalogDevice, useProducts, useReferenceCatalog, useUnits } from '@/lib/queries';
import { CONDITION_LABELS } from '@/lib/contract';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/products/product-card';
import { ProductVisual } from '@/components/products/product-visual';
import { DeviceSpecs } from '@/components/products/device-specs';
import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';

const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Vitrine : tous les articles en cartes (photo, prix, version, stock). Le vendeur retrouve un produit
 * en un coup d'œil, voit les appareils disponibles et lance la vente d'un appareil précis.
 */
export default function ShowcasePage() {
  const { establishment } = useAuth();
  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (v: number) => `${(v || 0).toLocaleString('fr-FR')} ${currency}`;
  const { data: products = [], isLoading } = useProducts();
  const reference = useReferenceCatalog().data ?? [];
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [open, setOpen] = useState<Product | null>(null);

  const categories = useMemo(() => {
    const slugs = [...new Set(products.map((p) => p.category))];
    return slugs.map((slug) => ({ slug, name: reference.find((r) => r.slug === slug)?.name || slug, count: products.filter((p) => p.category === slug).length }));
  }, [products, reference]);

  const shown = useMemo(() => {
    const q = norm(search.trim());
    return products
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => !inStockOnly || p.stockQuantity > 0)
      .filter((p) => !q || norm([p.name, p.brand, p.model, p.color, p.sku, p.barcode].filter(Boolean).join(' ')).includes(q))
      .sort((a, b) => Number(b.stockQuantity > 0) - Number(a.stockQuantity > 0) || a.name.localeCompare(b.name, 'fr'));
  }, [products, category, inStockOnly, search]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-gold" /> Vitrine
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">Touchez un article pour voir les appareils disponibles et le vendre.</p>
        </div>
        <Link href="/app/scan" className="h-11 px-4 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center gap-2 shrink-0 shadow-md shadow-gold/20">
          <ScanLine className="w-4 h-4" /> <span className="hidden sm:inline">Scanner</span>
        </Link>
      </div>

      {/* Recherche et filtres */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : iPhone 15, Samsung, 256 Go, noir…"
            className="w-full h-12 pl-10 pr-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-gold shadow-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <Pill on={category === 'all'} onClick={() => setCategory('all')}>
            Tout <span className="opacity-60">{products.length}</span>
          </Pill>
          {categories.map((c) => (
            <Pill key={c.slug} on={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name} <span className="opacity-60">{c.count}</span>
            </Pill>
          ))}
          <Pill on={inStockOnly} onClick={() => setInStockOnly(!inStockOnly)} tone="emerald">
            En stock seulement
          </Pill>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-neutral-800 bg-neutral-950 p-2.5 space-y-2 animate-pulse">
              <div className="aspect-square rounded-2xl bg-neutral-900" />
              <div className="h-3 rounded bg-neutral-900 w-3/4" />
              <div className="h-4 rounded bg-neutral-900 w-1/2" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 p-10 text-center">
          <PackageSearch className="w-10 h-10 text-neutral-600 mx-auto" />
          <p className="text-sm text-neutral-400 mt-3">{search ? `Aucun article pour « ${search} ».` : 'Aucun article en stock dans cette catégorie.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {shown.map((p, i) => (
            <BlurFade key={p._id} delay={Math.min(i, 10) * 0.03}>
              <ProductCard product={p} formatPrice={formatPrice} onClick={() => setOpen(p)} />
            </BlurFade>
          ))}
        </div>
      )}

      <AnimatePresence>{open && <ProductSheet product={open} formatPrice={formatPrice} categoryName={categories.find((c) => c.slug === open.category)?.name} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
}

function Pill({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: 'emerald' }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'h-9 px-3.5 rounded-full border text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors shrink-0',
        on
          ? tone === 'emerald'
            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
            : 'bg-gold/15 border-gold text-gold-soft'
          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
      )}
    >
      {children}
    </button>
  );
}

/** Fiche détaillée : photo, infos, appareils disponibles (vente directe d'un N° de série) */
function ProductSheet({ product, formatPrice, categoryName, onClose }: { product: Product; formatPrice: (v: number) => string; categoryName?: string; onClose: () => void }) {
  const router = useRouter();
  const units = useUnits({ productId: product._id, status: 'in_stock', limit: '50' }, !!product.hasSerialNumbers);
  const available = product.hasSerialNumbers ? units.data ?? [] : [];
  const device = useCatalogDevice(product.deviceId);
  const rows: Array<[string, string | null | undefined]> = [
    ['Catégorie', categoryName],
    ['Marque', product.brand],
    ['Version', product.model],
    ['Couleur', product.color],
    ['État', product.condition ? CONDITION_LABELS[product.condition] : 'Neuf'],
    ['Accessoires', product.accessories],
  ];

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-neutral-950 border border-neutral-800 shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
        <ProductVisual imageId={product.imageId} category={product.category} brand={product.brand} name={product.name} className="w-full aspect-[4/3]" rounded="rounded-t-3xl sm:rounded-t-3xl rounded-b-none" />
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xl font-black text-white leading-tight">{product.name}</p>
            <p className="text-3xl font-black text-gold-soft mt-1">{formatPrice(product.salePrice)}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="text-white text-right font-medium">{v}</dd>
                </React.Fragment>
              ))}
          </dl>
          <DeviceSpecs specs={device?.specs} />

          {product.hasSerialNumbers ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                {available.length ? `${available.length} appareil${available.length > 1 ? 's' : ''} disponible${available.length > 1 ? 's' : ''}` : units.isLoading ? 'Recherche des appareils…' : 'Aucun appareil en stock'}
              </p>
              {available.map((u) => (
                <div key={u._id} className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
                  <span className="font-mono text-sm text-white truncate">{u.serialNumber}</span>
                  <button
                    onClick={() => router.push(`/app/scan?code=${encodeURIComponent(u.serialNumber)}`)}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <ShoppingCart className="w-4 h-4" /> Vendre
                  </button>
                </div>
              ))}
              <p className="text-[11px] text-neutral-500">Vérifiez que le N° de série correspond à l&apos;appareil remis au client (ou scannez-le directement).</p>
            </div>
          ) : (
            <button
              onClick={() => router.push(product.barcode ? `/app/scan?code=${encodeURIComponent(product.barcode)}` : '/app/sales')}
              disabled={product.stockQuantity <= 0}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <ShoppingCart className="w-4 h-4" /> Vendre cet article
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
