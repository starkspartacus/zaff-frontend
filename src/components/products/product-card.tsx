'use client';

import React from 'react';
import { CONDITION_LABELS } from '@/lib/contract';
import type { Product } from '@/lib/types';
import { ProductVisual } from './product-visual';
import { cn } from '@/lib/utils';

/** Carte produit de la vitrine : photo, prix de vente, version, stock — lisible d'un coup d'œil */
export function ProductCard({ product, formatPrice, onClick }: { product: Product; formatPrice: (v: number) => string; onClick?: () => void }) {
  const out = product.stockQuantity <= 0;
  const low = !out && product.stockQuantity <= (product.minStockAlert ?? 0);
  const version = [product.model, product.color].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left rounded-3xl border border-neutral-800 bg-neutral-950 p-2.5 flex flex-col gap-2 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-gold/50 transition-all',
        out && 'opacity-60'
      )}
    >
      <div className="relative">
        <ProductVisual imageId={product.imageId} category={product.category} brand={product.brand} name={product.name} className="w-full aspect-square" />
        <span
          className={cn(
            'theme-fixed absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow',
            out ? 'bg-red-600 text-white' : low ? 'bg-amber-400 text-black' : 'bg-emerald-500 text-white'
          )}
        >
          {out ? 'Rupture' : `${product.stockQuantity} en stock`}
        </span>
        {product.condition && product.condition !== 'new' && (
          <span className="theme-fixed absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-semibold">
            {CONDITION_LABELS[product.condition]}
          </span>
        )}
      </div>
      <div className="px-1 min-w-0 flex-1 flex flex-col">
        <p className="text-sm font-bold text-white leading-snug line-clamp-2">{product.name}</p>
        <p className="text-[11px] text-neutral-500 truncate min-h-4">{version || product.brand || ' '}</p>
        <p className="mt-auto pt-1 text-base font-black text-gold-soft">{formatPrice(product.salePrice)}</p>
      </div>
    </button>
  );
}
