'use client';

import React, { useState } from 'react';
import { Cable, Cpu, Gamepad2, HardDrive, Headphones, Laptop, Monitor, Package, Printer, Router, Smartphone, Tablet, Watch } from 'lucide-react';
import { imageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

const BY_CATEGORY: Record<string, { icon: React.ElementType; from: string; to: string }> = {
  smartphones: { icon: Smartphone, from: '#fde68a', to: '#f59e0b' },
  'ordinateurs-portables': { icon: Laptop, from: '#bfdbfe', to: '#3b82f6' },
  'ordinateurs-de-bureau': { icon: Monitor, from: '#c7d2fe', to: '#6366f1' },
  tablettes: { icon: Tablet, from: '#ddd6fe', to: '#8b5cf6' },
  ecrans: { icon: Monitor, from: '#bae6fd', to: '#0ea5e9' },
  imprimantes: { icon: Printer, from: '#e2e8f0', to: '#64748b' },
  'montres-connectees': { icon: Watch, from: '#fbcfe8', to: '#ec4899' },
  audio: { icon: Headphones, from: '#fecaca', to: '#ef4444' },
  reseau: { icon: Router, from: '#a7f3d0', to: '#10b981' },
  stockage: { icon: HardDrive, from: '#fed7aa', to: '#f97316' },
  composants: { icon: Cpu, from: '#99f6e4', to: '#14b8a6' },
  accessoires: { icon: Cable, from: '#d9f99d', to: '#84cc16' },
  'consoles-jeux': { icon: Gamepad2, from: '#c4b5fd', to: '#7c3aed' },
};

/**
 * Visuel d'un produit : la photo de la base partagée, sinon une illustration colorée
 * (icône de la catégorie + marque) pour que chaque article reste reconnaissable d'un coup d'œil.
 */
export function ProductVisual({
  imageId,
  src,
  category,
  brand,
  name,
  className,
  rounded = 'rounded-2xl',
}: {
  imageId?: string | null;
  src?: string | null;
  category?: string | null;
  brand?: string | null;
  name?: string;
  className?: string;
  rounded?: string;
}) {
  const [broken, setBroken] = useState(false);
  const url = src || imageUrl(imageId);
  const style = BY_CATEGORY[category || ''] || { icon: Package, from: '#fde68a', to: '#d4a017' };
  const Icon = style.icon;

  if (url && !broken) {
    return (
      <div className={cn('theme-fixed relative overflow-hidden bg-white', rounded, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- images servies par l'API (base partagée), déjà réduites */}
        <img src={url} alt={name || 'Photo du produit'} loading="lazy" decoding="async" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-contain p-2" />
      </div>
    );
  }
  return (
    <div
      className={cn('theme-fixed relative overflow-hidden flex flex-col items-center justify-center', rounded, className)}
      style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
      aria-label={name}
    >
      <div className="absolute -right-4 -bottom-4 w-2/3 h-2/3 rounded-full bg-white/20" />
      <Icon className="relative w-1/3 h-1/3 min-w-5 min-h-5 text-white drop-shadow" strokeWidth={1.6} />
      {brand && <span className="relative mt-1 max-w-[90%] truncate text-[10px] font-black uppercase tracking-wider text-white/90">{brand}</span>}
    </div>
  );
}
