'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, EyeOff, Inbox, RotateCcw, Search, Store, X } from 'lucide-react';
import {
  acceptRequest,
  dismissRequest,
  mergeRequest,
  reopenRequest,
  useAdminDevices,
  useAdminCategories,
  useAdminRefresh,
  useDeviceRequests,
  type DeviceRequest,
  type RequestStatus,
} from '@/lib/admin-api';
import { errorMessage } from '@/lib/types';
import { ProductVisual } from '@/components/products/product-visual';
import { DeviceEditorModal } from '@/components/admin/device-editor';
import { cn } from '@/lib/utils';

const TABS: [RequestStatus, string][] = [
  ['open', 'À traiter'],
  ['added', 'Ajoutées'],
  ['dismissed', 'Ignorées'],
];

/**
 * Demandes d'ajout : modèles que des boutiques ont saisis à la main faute de les trouver dans le catalogue.
 * Les ajouter rattache automatiquement leurs produits (puis leur transmet les photos dès qu'elles existent).
 */
export default function AdminRequestsPage() {
  const [status, setStatus] = useState<RequestStatus>('open');
  const { data: requests, isLoading } = useDeviceRequests(status);
  const categories = useAdminCategories().data ?? [];
  const refresh = useAdminRefresh();
  const [editing, setEditing] = useState<DeviceRequest | null>(null);
  const [merging, setMerging] = useState<DeviceRequest | null>(null);
  const [done, setDone] = useState<{ id: string; name: string; linked: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Demandes d&apos;ajout</h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Modèles saisis par les boutiques et absents du catalogue, les plus demandés d&apos;abord. Une fois ajoutés, leurs produits y sont rattachés et
          reçoivent les photos automatiquement.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setStatus(v)}
            className={cn('h-9 px-3 rounded-full border text-xs font-semibold', status === v ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400')}
          >
            {l}
          </button>
        ))}
      </div>

      {done && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-emerald-300">
            « {done.name} » ajouté au catalogue · {done.linked} produit{done.linked > 1 ? 's' : ''} de boutique rattaché{done.linked > 1 ? 's' : ''}.
          </p>
          <Link href={`/admin/device?id=${done.id}`} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
            Ajouter ses photos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}
      {requests && requests.length === 0 && (
        <p className="rounded-3xl border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500 flex flex-col items-center gap-2">
          <Inbox className="w-8 h-8" />
          {status === 'open' ? 'Aucune demande : les boutiques trouvent tous leurs modèles dans le catalogue.' : 'Rien ici pour le moment.'}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {requests?.map((r) => (
          <div key={r.id} className="rounded-3xl border border-neutral-800 bg-neutral-950 p-3 flex gap-3">
            <ProductVisual category={r.category || undefined} brand={r.brand} name={r.model} className="w-20 h-20 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div>
                <p className="text-[11px] text-neutral-500 truncate">
                  {r.brand}
                  {r.category ? ` · ${categories.find((c) => c.slug === r.category)?.name || r.category}` : ''}
                </p>
                <p className="text-sm font-bold text-white truncate">{r.model}</p>
              </div>
              <p className="text-[11px] text-gold flex items-center gap-1">
                <Store className="w-3.5 h-3.5" /> {r.shops} boutique{r.shops > 1 ? 's' : ''}
              </p>
              {(r.variants.length > 0 || r.colors.length > 0) && <p className="text-[11px] text-neutral-500 truncate">{[...r.variants, ...r.colors].join(' · ')}</p>}
              <div className="flex gap-1.5 pt-1">
                {r.status === 'open' && (
                  <>
                    <button onClick={() => setEditing(r)} className="h-9 px-3 rounded-xl bg-gradient-to-r from-gold to-gold-deep text-ink text-xs font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Ajouter
                    </button>
                    <button onClick={() => setMerging(r)} className="h-9 px-3 rounded-xl border border-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1" title="Ce modèle existe déjà dans le catalogue, écrit autrement">
                      <Copy className="w-3.5 h-3.5" /> Doublon
                    </button>
                    <button onClick={() => act(() => dismissRequest(r.id))} className="h-9 px-3 rounded-xl border border-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1">
                      <EyeOff className="w-3.5 h-3.5" /> Ignorer
                    </button>
                  </>
                )}
                {r.status === 'added' && r.deviceId && (
                  <Link href={`/admin/device?id=${r.deviceId}`} className="h-9 px-3 rounded-xl border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1">
                    Voir l&apos;appareil <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                {r.status === 'dismissed' && (
                  <button onClick={() => act(() => reopenRequest(r.id))} className="h-9 px-3 rounded-xl border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Remettre à traiter
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {merging && (
        <MergeModal
          request={merging}
          onClose={() => setMerging(null)}
          onPick={async (deviceId) => {
            setError(null);
            try {
              const r = await mergeRequest(merging.id, deviceId);
              setDone({ id: r.device.id, name: `${r.device.brand} ${r.device.model}`, linked: r.linked });
              setMerging(null);
              await refresh();
            } catch (err) {
              setError(errorMessage(err));
              setMerging(null);
            }
          }}
        />
      )}
      {editing && (
        <DeviceEditorModal
          prefill={{ category: editing.category && categories.some((c) => c.slug === editing.category) ? editing.category : '', brand: editing.brand, model: editing.model, variants: editing.variants, colors: editing.colors }}
          submitLabel="Ajouter au catalogue"
          onSubmit={async (dto) => {
            const r = await acceptRequest(editing.id, dto);
            setDone({ id: r.device.id, name: `${r.device.brand} ${r.device.model}`, linked: r.linked });
            return r.device;
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Choix de l'appareil existant auquel rattacher une demande en doublon */
function MergeModal({ request, onPick, onClose }: { request: DeviceRequest; onPick: (deviceId: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState(request.model);
  const [busy, setBusy] = useState(false);
  const { data } = useAdminDevices({ search: search.trim() || undefined, limit: 12 });
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-neutral-950 border border-neutral-800 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Doublon de…</h2>
            <p className="text-xs text-neutral-400">
              « {request.brand} {request.model} » sera reconnu comme cet appareil : produits rattachés, photos transmises, plus de demande pour cette écriture.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher l'appareil"
            aria-label="Rechercher l'appareil"
            className="w-full h-11 pl-9 pr-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold"
          />
        </div>
        <div className="space-y-1.5">
          {data?.items.map((d) => (
            <button
              key={d.id}
              disabled={busy}
              onClick={() => (setBusy(true), onPick(d.id))}
              className="w-full flex items-center gap-3 rounded-2xl border border-neutral-800 p-2 text-left hover:border-gold/60 disabled:opacity-60"
            >
              <ProductVisual imageId={d.imageId} size="thumb" category={d.category} brand={d.brand} name={d.model} className="w-12 h-12 shrink-0" rounded="rounded-xl" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white truncate">{d.model}</span>
                <span className="block text-[11px] text-neutral-500">{d.brand}</span>
              </span>
            </button>
          ))}
          {data && !data.items.length && <p className="text-xs text-neutral-500">Aucun appareil : essayez une autre recherche.</p>}
        </div>
      </div>
    </div>
  );
}
