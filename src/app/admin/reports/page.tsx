'use client';

import React, { useState } from 'react';
import { CheckCircle2, Flag, Trash2 } from 'lucide-react';
import { keepReportedPhoto, removeReportedPhoto, useAdminRefresh, useReportedPhotos } from '@/lib/admin-api';
import { errorMessage } from '@/lib/types';
import { ProductVisual } from '@/components/products/product-visual';

/** Photos signalées par les boutiques : l'administrateur les garde ou les retire */
export default function AdminReportsPage() {
  const { data = [], isLoading } = useReportedPhotos();
  const refresh = useAdminRefresh();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Flag className="w-6 h-6 text-gold" /> Signalements
        </h1>
        <p className="text-xs text-neutral-400">
          Une photo signalée par 3 boutiques n&apos;est plus proposée. Gardez-la (signalements effacés) ou retirez-la (effacée si aucune boutique
          ne l&apos;utilise).
        </p>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {isLoading ? (
        <p className="text-sm text-neutral-500">Chargement…</p>
      ) : data.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          Aucun signalement.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {data.map((img) => (
            <div key={img.id} className="rounded-3xl border border-neutral-800 bg-neutral-950 p-2.5 space-y-2">
              <div className="relative">
                <ProductVisual imageId={img.id} size="thumb" name={img.model} className="w-full aspect-square" />
                <span className={`theme-fixed absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${img.hidden ? 'bg-red-600 text-white' : 'bg-amber-400 text-black'}`}>
                  {img.hidden ? 'Masquée' : `${img.reports} signalement${(img.reports || 0) > 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="px-1">
                <p className="text-xs font-bold text-white truncate">
                  {img.brand} {img.model}
                </p>
                <p className="text-[11px] text-neutral-500 truncate">
                  {img.color || 'Tous coloris'} · utilisée par {img.usage} produit{img.usage > 1 ? 's' : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button disabled={busy === img.id} onClick={() => act(img.id, () => keepReportedPhoto(img.id))} className="h-9 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold">
                  Garder
                </button>
                <button
                  disabled={busy === img.id}
                  onClick={() => window.confirm('Retirer cette photo du catalogue ?') && act(img.id, () => removeReportedPhoto(img.id))}
                  className="h-9 rounded-xl border border-red-500/40 text-red-400 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Retirer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
