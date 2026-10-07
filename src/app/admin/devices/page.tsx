'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ImageOff, Plus, Search } from 'lucide-react';
import { useAdminCategories, useAdminDevices, useDeviceStats } from '@/lib/admin-api';
import { ProductVisual } from '@/components/products/product-visual';
import { DeviceEditorModal } from '@/components/admin/device-editor';
import { cn } from '@/lib/utils';

export default function AdminDevicesPage() {
  return (
    <Suspense fallback={null}>
      <DevicesList />
    </Suspense>
  );
}

function DevicesList() {
  const params = useSearchParams();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [photos, setPhotos] = useState(params.get('photos') || '');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const reference = useAdminReference();
  const stats = useDeviceStats().data;
  const { data, isFetching } = useAdminDevices({ search: search || undefined, category: category || undefined, photos: photos || undefined, page, limit: 48 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Appareils</h1>
          <p className="text-xs text-neutral-400">
            {stats ? `${stats.devices} appareils · ${stats.missingPhotos} sans photo` : 'Chargement…'}
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="h-11 px-4 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvel appareil
        </button>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher : iPhone 15, Galaxy A55, Spark…"
            className="w-full h-12 pl-10 pr-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ['', 'Toutes les photos'],
            ['missing', 'Sans photo'],
            ['with', 'Avec photo'],
          ].map(([v, l]) => (
            <Pill key={v} on={photos === v} onClick={() => (setPhotos(v), setPage(1))}>
              {l}
            </Pill>
          ))}
          <span className="w-px bg-neutral-800 mx-1 shrink-0" />
          <Pill on={!category} onClick={() => (setCategory(''), setPage(1))}>
            Toutes catégories
          </Pill>
          {reference.map((r) => (
            <Pill key={r.slug} on={category === r.slug} onClick={() => (setCategory(r.slug), setPage(1))}>
              {r.name}
            </Pill>
          ))}
        </div>
      </div>

      <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 transition-opacity', isFetching && 'opacity-70')}>
        {data?.items.map((d) => (
          <Link key={d.id} href={`/admin/device?id=${d.id}`} className={cn('rounded-3xl border bg-neutral-950 p-2.5 hover:border-gold/50 transition-colors', d.active ? 'border-neutral-800' : 'border-dashed border-neutral-700 opacity-60')}>
            <div className="relative">
              <ProductVisual imageId={d.imageId} size="thumb" category={d.category} brand={d.brand} name={d.model} className="w-full aspect-square" />
              <span
                className={cn(
                  'theme-fixed absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold',
                  d.photos.length ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-black'
                )}
              >
                {d.photos.length ? `${d.photos.length} photo${d.photos.length > 1 ? 's' : ''}` : 'Sans photo'}
              </span>
            </div>
            <p className="mt-2 px-1 text-xs font-bold text-white truncate">{d.model}</p>
            <p className="px-1 text-[11px] text-neutral-500 truncate">
              {d.brand} · {d.colors.length} coloris{d.active ? '' : ' · masqué'}
            </p>
          </Link>
        ))}
      </div>
      {data && data.items.length === 0 && (
        <p className="rounded-3xl border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500 flex flex-col items-center gap-2">
          <ImageOff className="w-8 h-8" /> Aucun appareil ne correspond.
        </p>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-9 px-3 rounded-xl border border-neutral-800 disabled:opacity-40">
            Précédent
          </button>
          <span className="text-neutral-400">
            Page {page} / {pages}
          </span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="h-9 px-3 rounded-xl border border-neutral-800 disabled:opacity-40">
            Suivant
          </button>
        </div>
      )}

      {creating && <DeviceEditorModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function useAdminReference() {
  return useAdminCategories().data ?? [];
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-9 px-3.5 rounded-full border text-xs font-semibold whitespace-nowrap shrink-0',
        on ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
      )}
    >
      {children}
    </button>
  );
}
