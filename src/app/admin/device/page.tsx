'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Camera, Loader2, Pencil, Sparkles, Star, Trash2, UploadCloud, X } from 'lucide-react';
import { createAiJob, removeDevicePhoto, setDefaultPhoto, uploadDevicePhoto, useAiStatus, useAdminCategories, useAdminDevice, useAdminRefresh } from '@/lib/admin-api';
import { prepareImage, type PreparedImage } from '@/lib/images';
import { errorMessage } from '@/lib/types';
import { ProductVisual } from '@/components/products/product-visual';
import { DeviceEditorModal } from '@/components/admin/device-editor';
import { cn } from '@/lib/utils';

export default function AdminDevicePage() {
  return (
    <Suspense fallback={null}>
      <DeviceView />
    </Suspense>
  );
}

interface Pending extends PreparedImage {
  key: string;
  preview: string;
  color: string;
  status: 'ready' | 'uploading' | 'done' | 'error';
  error?: string;
}

/** Un appareil du catalogue global : informations et photos conformes par coloris */
function DeviceView() {
  const id = useSearchParams().get('id');
  const { data: device, isLoading } = useAdminDevice(id);
  const categories = useAdminCategories().data ?? [];
  const refresh = useAdminRefresh();
  const [editing, setEditing] = useState(false);
  const [color, setColor] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const router = useRouter();
  const aiEnabled = useAiStatus().data?.enabled;
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  if (!id) return <p className="text-sm text-neutral-500">Aucun appareil indiqué.</p>;
  if (isLoading || !device) return <p className="text-sm text-neutral-500">Chargement…</p>;

  const categoryName = categories.find((c) => c.slug === device.category)?.name || device.category;
  const photos = filter === null ? device.photos : device.photos.filter((p) => (p.color || '') === filter);

  /** Photos préparées sur l'appareil : rien n'est envoyé avant « Envoyer » */
  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    for (const file of [...files].filter((f) => f.type.startsWith('image/')).slice(0, 30)) {
      try {
        const prepared = await prepareImage(file);
        setPending((prev) => [...prev, { ...prepared, key: `${Date.now()}-${file.name}`, preview: URL.createObjectURL(prepared.blob), color, status: 'ready' }]);
      } catch (err) {
        setError(errorMessage(err));
      }
    }
  };

  const send = async () => {
    setRunning(true);
    for (const p of pending.filter((x) => x.status === 'ready' || x.status === 'error')) {
      setPending((prev) => prev.map((x) => (x.key === p.key ? { ...x, status: 'uploading' } : x)));
      try {
        await uploadDevicePhoto(device.id, p, p.color || null);
        setPending((prev) => prev.map((x) => (x.key === p.key ? { ...x, status: 'done' } : x)));
      } catch (err) {
        setPending((prev) => prev.map((x) => (x.key === p.key ? { ...x, status: 'error', error: errorMessage(err) } : x)));
      }
    }
    await refresh();
    setPending((prev) => {
      prev.filter((x) => x.status === 'done').forEach((x) => URL.revokeObjectURL(x.preview));
      return prev.filter((x) => x.status !== 'done');
    });
    setRunning(false);
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const toSend = pending.filter((p) => p.status === 'ready' || p.status === 'error').length;

  return (
    <div className="space-y-6 pb-10">
      <Link href="/admin/devices" className="text-xs text-neutral-400 hover:text-white inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Appareils
      </Link>

      <div className="flex flex-col sm:flex-row gap-5">
        <ProductVisual imageId={device.imageId} category={device.category} brand={device.brand} name={device.model} className="w-full sm:w-56 aspect-square shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-500">
                {categoryName} · {device.brand}
              </p>
              <h1 className="text-2xl font-black text-white">{device.model}</h1>
              {!device.active && <p className="text-xs text-amber-400 mt-1">Masqué : les boutiques ne le voient pas.</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              {aiEnabled && (
                <button
                  onClick={() => act(async () => (await createAiJob({ deviceIds: [device.id] }), router.push('/admin/ai')))}
                  className="h-10 px-3 rounded-xl bg-gold/10 border border-gold/40 text-gold-soft text-xs font-semibold flex items-center gap-1.5"
                  title="L'IA cherche et vérifie les photos officielles de ce modèle"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Chercher avec l&apos;IA
                </button>
              )}
              {aiEnabled && (
                <button
                  onClick={() => act(async () => (await createAiJob({ kind: 'specs', deviceIds: [device.id] }), router.push('/admin/ai')))}
                  className="h-10 px-3 rounded-xl border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5"
                  title="Coloris officiels, capacités et fiche technique d'après les données du marché"
                >
                  Compléter la fiche
                </button>
              )}
              <button onClick={() => setEditing(true)} className="h-10 px-3 rounded-xl border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-gold" /> Modifier
              </button>
            </div>
          </div>
          <Info label="Capacités" values={device.variants} />
          <div>
            <p className="text-[11px] text-neutral-500">Coloris</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {device.colors.length ? (
                device.colors.map((c) => {
                  const hex = device.colorCodes.find((x) => x.name.toLowerCase() === c.toLowerCase())?.hex;
                  return (
                    <span key={c} className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-white flex items-center gap-1.5">
                      {hex && <span className="theme-fixed w-3 h-3 rounded-full border border-black/20" style={{ background: hex }} />}
                      {c}
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-neutral-600">—</span>
              )}
            </div>
          </div>
          {device.aiFilledAt && <p className="text-[11px] text-neutral-500">Fiche complétée par l&apos;IA le {new Date(device.aiFilledAt).toLocaleDateString('fr-FR')} : vérifiez-la.</p>}
          <p className="text-xs text-neutral-400">
            {device.shops ? `Dans le catalogue de ${device.shops} boutique${device.shops > 1 ? 's' : ''} : chaque photo ajoutée est transmise à leurs produits sans photo.` : "Aucune boutique ne l'utilise encore."}
          </p>
          {device.prices.length > 0 && (
            <p className="text-xs text-neutral-400">
              Prix pratiqués :{' '}
              {device.prices.map((p) => `${p.variant || 'toutes capacités'} ~${p.median.toLocaleString('fr-FR')} ${p.currency} (${p.shops} boutiques)`).join(' · ')}
            </p>
          )}
          {device.aliases > 0 && <p className="text-[11px] text-neutral-500">{device.aliases} autre(s) écriture(s) reconnue(s) (doublons fusionnés).</p>}
          {device.specs.length > 0 && (
            <dl className="rounded-2xl border border-neutral-800 divide-y divide-neutral-800 text-xs">
              {device.specs.map((s) => (
                <div key={s.label} className="flex gap-3 px-3 py-2">
                  <dt className="w-32 shrink-0 text-neutral-500">{s.label}</dt>
                  <dd className="text-white">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {/* Photos */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">Photos ({device.photos.length})</h2>
          <div className="flex gap-1.5 overflow-x-auto">
            <Chip on={filter === null} onClick={() => setFilter(null)}>
              Toutes
            </Chip>
            {[...new Set(device.photos.map((p) => p.color || ''))].map((c) => (
              <Chip key={c || 'all'} on={filter === c} onClick={() => setFilter(c)}>
                {c || 'Tous coloris'}
              </Chip>
            ))}
          </div>
        </div>
        {photos.length === 0 && <p className="text-xs text-neutral-500">Pas encore de photo : ajoutez-en ci-dessous.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {photos.map((p) => {
            const isDefault = device.imageId === p.imageId;
            return (
              <div key={p.imageId} className={cn('relative rounded-2xl border-2 overflow-hidden', isDefault ? 'border-gold' : 'border-neutral-800')}>
                <ProductVisual imageId={p.imageId} size="thumb" name={device.model} className="w-full aspect-square" rounded="rounded-none" />
                <span className="theme-fixed absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/60 px-1 text-[10px] font-semibold text-white">
                  {p.color || 'Tous coloris'}
                </span>
                <div className="theme-fixed absolute top-1 right-1 flex gap-1">
                  <button
                    onClick={() => act(() => setDefaultPhoto(device.id, p.imageId))}
                    className={cn('w-7 h-7 rounded-full flex items-center justify-center', isDefault ? 'bg-gold text-black' : 'bg-black/60 text-white')}
                    title="Photo par défaut"
                    aria-label="Photo par défaut"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => window.confirm('Retirer cette photo ? Elle est effacée si aucune boutique ne l\'utilise.') && act(() => removeDevicePhoto(device.id, p.imageId))}
                    className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600"
                    aria-label="Retirer la photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ajout de photos */}
      <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
        <h2 className="text-sm font-bold text-white">Ajouter des photos</h2>
        <p className="text-xs text-neutral-500">
          Photo nette de l&apos;appareil de face, fond clair, sans texte ni logo de boutique. Réduite automatiquement (≤ 1000 px + vignette) ; envoyée
          seulement en cliquant sur « Envoyer ».
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={color === ''} onClick={() => setColor('')}>
            Tous coloris
          </Chip>
          {device.colors.map((c) => (
            <Chip key={c} on={color === c} onClick={() => setColor(c)}>
              {c}
            </Chip>
          ))}
        </div>
        <button onClick={() => fileRef.current?.click()} className="h-11 px-4 rounded-2xl border-2 border-dashed border-neutral-700 text-neutral-300 hover:border-gold text-sm font-semibold flex items-center gap-2">
          <Camera className="w-4 h-4 text-gold" /> Choisir des photos{color ? ` (${color})` : ''}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />

        {pending.length > 0 && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {pending.map((p) => (
                <div key={p.key} className={cn('relative rounded-2xl border overflow-hidden', p.status === 'error' ? 'border-red-500' : 'border-neutral-800')}>
                  <ProductVisual src={p.preview} name="Photo" className="w-full aspect-square" rounded="rounded-none" />
                  <span className="theme-fixed absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/60 px-1 text-[10px] text-white">
                    {p.status === 'uploading' ? 'Envoi…' : p.status === 'error' ? p.error : p.color || 'Tous coloris'}
                  </span>
                  {p.status !== 'uploading' && (
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(p.preview);
                        setPending((prev) => prev.filter((x) => x.key !== p.key));
                      }}
                      className="theme-fixed absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                      aria-label="Retirer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={send}
              disabled={running || toSend === 0}
              className="h-12 px-5 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              Envoyer {toSend} photo{toSend > 1 ? 's' : ''}
            </button>
          </>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </section>

      {editing && <DeviceEditorModal device={device} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Info({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-[11px] text-neutral-500">{label}</p>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {values.length ? values.map((v) => <span key={v} className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-white">{v}</span>) : <span className="text-xs text-neutral-600">—</span>}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap shrink-0', on ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400')}
    >
      {children}
    </button>
  );
}
