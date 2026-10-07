'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Flag, ImagePlus, Images, Smartphone, Tags } from 'lucide-react';
import { useAdminDevices, useAdminUsage, useDeviceStats } from '@/lib/admin-api';
import { formatBytes } from '@/lib/images';
import { ProductVisual } from '@/components/products/product-visual';
import { NumberTicker } from '@/components/magicui/number-ticker';

/** Tableau de bord : où en est le catalogue global (appareils sans photo d'abord) */
export default function AdminDashboard() {
  const { data: stats } = useDeviceStats();
  const usage = useAdminUsage().data;
  const missing = useAdminDevices({ photos: 'missing', limit: 12 }).data;
  const coverage = stats && stats.devices ? Math.round((stats.withPhotos / stats.devices) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Catalogue global</h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Les boutiques créent leurs produits à partir de ces appareils et récupèrent leurs photos automatiquement.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Smartphone} label="Appareils" value={stats?.devices ?? 0} hint={`${stats?.active ?? 0} visibles par les boutiques · ${stats?.brands ?? 0} marques`} />
        <Card icon={Images} label="Avec photo" value={stats?.withPhotos ?? 0} hint={`${coverage} % du catalogue · ${stats?.photos ?? 0} photos`} bar={coverage / 100} />
        <Card icon={ImagePlus} label="Sans photo" value={stats?.missingPhotos ?? 0} hint="Priorité : les modèles les plus vendus" tone="amber" />
        <Card icon={Flag} label="Signalements" value={stats?.reported ?? 0} hint="Photos signalées par les boutiques" tone={stats?.reported ? 'red' : undefined} href="/admin/reports" />
      </div>

      {usage && (
        <p className="text-xs text-neutral-500 flex items-center gap-2">
          <Tags className="w-3.5 h-3.5 text-gold" />
          Stockage : {usage.storage === 'uploadthing' ? 'UploadThing' : 'base de données (renseignez UPLOADTHING_TOKEN en production)'} · {usage.shared.photos} photos ·{' '}
          {formatBytes(usage.shared.bytes)}
          {usage.provider?.limitBytes ? ` · quota ${Math.round((usage.provider.totalBytes / usage.provider.limitBytes) * 100)} %` : ''}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-bold text-white">Appareils à photographier</h2>
          <Link href="/admin/devices?photos=missing" className="text-xs text-gold flex items-center gap-1">
            Tout voir <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {missing?.items.map((d) => (
            <Link key={d.id} href={`/admin/device?id=${d.id}`} className="rounded-3xl border border-neutral-800 bg-neutral-950 p-2.5 hover:border-gold/50 transition-colors">
              <ProductVisual category={d.category} brand={d.brand} name={d.model} className="w-full aspect-square" />
              <p className="mt-2 px-1 text-xs font-bold text-white truncate">{d.model}</p>
              <p className="px-1 text-[11px] text-neutral-500 truncate">{d.brand}</p>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/import" className="h-11 px-4 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center gap-2">
            <ImagePlus className="w-4 h-4" /> Importer des photos en masse
          </Link>
          <Link href="/admin/devices" className="h-11 px-4 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-gold" /> Gérer les appareils
          </Link>
        </div>
      </section>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  hint,
  bar,
  tone,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  hint: string;
  bar?: number;
  tone?: 'amber' | 'red';
  href?: string;
}) {
  const body = (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-4 h-full">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-400">{label}</p>
        <Icon className={tone === 'red' ? 'w-4 h-4 text-red-400' : tone === 'amber' ? 'w-4 h-4 text-amber-400' : 'w-4 h-4 text-gold'} />
      </div>
      <p className="text-3xl font-black text-white mt-1">
        <NumberTicker value={value} />
      </p>
      <p className="text-[11px] text-neutral-500 mt-0.5">{hint}</p>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-gold to-emerald-500" style={{ width: `${Math.round(bar * 100)}%` }} />
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
