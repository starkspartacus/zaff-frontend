'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Copy, FolderOpen, Images, Loader2, Trash2, UploadCloud, Wand2, X } from 'lucide-react';
import { useDeviceCatalog, useReferenceCatalog } from '@/lib/queries';
import { deleteLibraryImage, imageUrl, shrinkImage, uploadImageBlob, useMyLibrary } from '@/lib/images';
import { guessFromFilename } from '@/lib/photo-guess';
import { errorMessage } from '@/lib/types';
import { ProductVisual } from '@/components/products/product-visual';
import { cn } from '@/lib/utils';

type Status = 'ready' | 'uploading' | 'done' | 'duplicate' | 'error';

interface Item {
  id: string;
  file: File;
  preview: string;
  brand: string;
  model: string;
  color: string;
  category: string;
  status: Status;
  error?: string;
}

const MAX_BATCH = 200;
const CONCURRENCY = 3;

/**
 * Photothèque (propriétaire) : import en masse de photos dans la base partagée par toutes les boutiques.
 * Les photos sont seulement préparées sur l'appareil (aperçu, marque / modèle / couleur devinés depuis
 * le nom du fichier) : rien n'est envoyé avant « Importer ».
 */
export default function PhotoLibraryPage() {
  const queryClient = useQueryClient();
  const devices = useDeviceCatalog().data;
  const reference = useReferenceCatalog().data ?? [];
  const library = useMyLibrary();
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Les aperçus en mémoire sont libérés en quittant la page
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const categoryName = (slug: string) => reference.find((r) => r.slug === slug)?.name || slug;

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const files = [...list].filter((f) => f.type.startsWith('image/'));
    const room = MAX_BATCH - items.length;
    if (files.length > room) setNotice(`Maximum ${MAX_BATCH} photos par import : ${files.length - room} photo(s) ignorée(s).`);
    else setNotice(null);
    const added = files.slice(0, Math.max(0, room)).map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      ...guessFromFilename(file.name, devices, reference),
      status: 'ready' as Status,
    }));
    setItems((prev) => [...prev, ...added]);
  };

  const update = (id: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: string) =>
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.preview);
      return prev.filter((i) => i.id !== id);
    });
  const clearDone = () =>
    setItems((prev) => {
      prev.filter((i) => i.status === 'done' || i.status === 'duplicate').forEach((i) => URL.revokeObjectURL(i.preview));
      return prev.filter((i) => i.status !== 'done' && i.status !== 'duplicate');
    });

  const isValid = (i: Item) => i.brand.trim().length > 0 && i.model.trim().length > 0;
  const todo = items.filter((i) => (i.status === 'ready' || i.status === 'error') && isValid(i));
  const invalid = items.filter((i) => i.status === 'ready' && !isValid(i));
  const done = items.filter((i) => i.status === 'done').length;
  const dup = items.filter((i) => i.status === 'duplicate').length;

  // Remplir d'un coup les champs vides (ex. toutes les photos d'un même arrivage)
  const [bulkBrand, setBulkBrand] = useState('');
  const applyBrand = () => {
    if (!bulkBrand.trim()) return;
    setItems((prev) => prev.map((i) => (i.status === 'ready' && !i.brand ? { ...i, brand: bulkBrand.trim() } : i)));
  };

  const run = async () => {
    setRunning(true);
    const queue = [...todo];
    const worker = async () => {
      for (let it = queue.shift(); it; it = queue.shift()) {
        update(it.id, { status: 'uploading', error: undefined });
        try {
          const blob = await shrinkImage(it.file);
          const res = await uploadImageBlob(
            blob,
            { brand: it.brand.trim(), model: it.model.trim(), color: it.color.trim() || undefined, category: it.category || undefined },
            { library: true }
          );
          update(it.id, { status: res.duplicate ? 'duplicate' : 'done' });
        } catch (err) {
          update(it.id, { status: 'error', error: errorMessage(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    await queryClient.invalidateQueries({ queryKey: ['images'] });
  };

  const total = items.filter((i) => i.status !== 'ready' || isValid(i)).length;
  const finished = items.filter((i) => ['done', 'duplicate', 'error'].includes(i.status)).length;
  const progress = total ? Math.round((finished / total) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Images className="w-6 h-6 text-gold" /> Photothèque
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Importez vos photos produits en une fois : elles alimentent la base partagée par toutes les boutiques ZAFF et sont
          proposées automatiquement à la création des produits.
        </p>
      </div>

      {/* Dépôt des fichiers */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-3xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors',
          dragging ? 'border-gold bg-gold/10' : 'border-neutral-700 bg-neutral-950'
        )}
      >
        <UploadCloud className="w-10 h-10 text-gold mx-auto" />
        <p className="mt-2 text-sm font-semibold text-white">Glissez vos photos ici</p>
        <p className="text-xs text-neutral-500 mt-1">
          Astuce : nommez les fichiers comme le produit (« Samsung Galaxy A55 5G bleu.jpg ») : la marque, le modèle et la couleur
          sont remplis tout seuls.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={() => fileRef.current?.click()} className="h-11 px-4 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center gap-2">
            <Images className="w-4 h-4" /> Choisir des photos
          </button>
          <button onClick={() => folderRef.current?.click()} className="h-11 px-4 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-gold" /> Choisir un dossier
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          // Sélection d'un dossier entier (navigateurs de bureau)
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))}
        />
      </div>

      {notice && <p className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-xs text-amber-300">{notice}</p>}

      {/* Photos préparées */}
      {items.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm font-bold text-white">
              {items.length} photo{items.length > 1 ? 's' : ''} préparée{items.length > 1 ? 's' : ''}
              <span className="font-normal text-neutral-500"> · rien n&apos;est envoyé avant « Importer »</span>
            </p>
            <div className="flex gap-2">
              <input
                value={bulkBrand}
                onChange={(e) => setBulkBrand(e.target.value)}
                placeholder="Marque pour les photos sans marque"
                className="h-10 w-56 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-gold"
              />
              <button onClick={applyBrand} className="h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-gold" /> Appliquer
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <motion.div
                  key={it.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={cn(
                    'rounded-3xl border bg-neutral-950 p-3 flex gap-3',
                    it.status === 'error' || (it.status === 'ready' && !isValid(it)) ? 'border-red-500/50' : it.status === 'done' ? 'border-emerald-500/50' : 'border-neutral-800'
                  )}
                >
                  <div className="relative w-24 shrink-0">
                    <ProductVisual src={it.preview} name={it.file.name} className="w-24 h-24" />
                    <StatusBadge status={it.status} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[10px] text-neutral-500 truncate" title={it.file.name}>
                        {it.file.name}
                      </p>
                      {(it.status === 'ready' || it.status === 'error') && (
                        <button onClick={() => remove(it.id)} className="p-0.5 text-neutral-500 hover:text-red-400" aria-label="Retirer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <MiniInput placeholder="Marque *" value={it.brand} onChange={(v) => update(it.id, { brand: v })} disabled={it.status !== 'ready' && it.status !== 'error'} invalid={!it.brand.trim()} />
                    <MiniInput placeholder="Modèle *" value={it.model} onChange={(v) => update(it.id, { model: v })} disabled={it.status !== 'ready' && it.status !== 'error'} invalid={!it.model.trim()} />
                    <div className="flex gap-1.5">
                      <MiniInput placeholder="Couleur" value={it.color} onChange={(v) => update(it.id, { color: v })} disabled={it.status !== 'ready' && it.status !== 'error'} />
                      {it.category && <span className="shrink-0 self-center text-[10px] text-neutral-500 truncate max-w-20">{categoryName(it.category)}</span>}
                    </div>
                    {it.error && <p className="text-[11px] text-red-400">{it.error}</p>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Ma photothèque */}
      <section className="space-y-3">
        <p className="text-sm font-bold text-white">
          Photos ajoutées par ma boutique <span className="font-normal text-neutral-500">({library.data?.length ?? 0})</span>
        </p>
        {library.data?.length ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
            {library.data.map((img) => (
              <LibraryTile key={img.id} img={img} onDeleted={() => queryClient.invalidateQueries({ queryKey: ['images'] })} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Aucune photo pour l&apos;instant.</p>
        )}
      </section>

      {/* Barre d'import */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-72 z-30 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-md px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-neutral-300 truncate">
                {running
                  ? `Import en cours… ${progress} %`
                  : `${todo.length} à importer${invalid.length ? ` · ${invalid.length} sans marque ou modèle` : ''}${done ? ` · ${done} importée(s)` : ''}${dup ? ` · ${dup} déjà présente(s)` : ''}`}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold to-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {(done > 0 || dup > 0) && !running && (
              <button onClick={clearDone} className="h-11 px-3 rounded-2xl text-xs text-neutral-400 hover:text-white">
                Vider les importées
              </button>
            )}
            <button
              onClick={run}
              disabled={running || todo.length === 0}
              className="h-11 px-5 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center gap-2 disabled:opacity-40 shrink-0"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {todo.length ? `Importer ${todo.length} photo${todo.length > 1 ? 's' : ''}` : 'Importer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'ready') return null;
  const map = {
    uploading: { cls: 'bg-sky-500 text-white', icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Envoi' },
    done: { cls: 'bg-emerald-500 text-white', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Importée' },
    duplicate: { cls: 'bg-neutral-700 text-white', icon: <Copy className="w-3 h-3" />, label: 'Déjà là' },
    error: { cls: 'bg-red-600 text-white', icon: <AlertTriangle className="w-3 h-3" />, label: 'Erreur' },
  }[status];
  return (
    <span className={cn('theme-fixed absolute bottom-1 left-1 right-1 rounded-lg px-1 py-0.5 text-[10px] font-bold flex items-center justify-center gap-1', map.cls)}>
      {map.icon} {map.label}
    </span>
  );
}

function MiniInput({ value, onChange, placeholder, disabled, invalid }: { value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean; invalid?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full h-8 px-2 rounded-lg bg-neutral-900 border text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-gold disabled:opacity-60',
        invalid ? 'border-red-500/50' : 'border-neutral-800'
      )}
    />
  );
}

function LibraryTile({ img, onDeleted }: { img: { id: string; brand: string; model: string; color: string | null; usage: number }; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const del = async () => {
    if (!window.confirm(`Supprimer définitivement la photo « ${img.brand} ${img.model} » ?`)) return;
    setBusy(true);
    try {
      await deleteLibraryImage(img.id);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <div className="group relative" title={[img.brand, img.model, img.color].filter(Boolean).join(' · ') + (error ? ` — ${error}` : '')}>
      <ProductVisual src={imageUrl(img.id)} name={img.model} className="w-full aspect-square border border-neutral-800" />
      <span className="theme-fixed absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/60 px-1 text-[9px] font-semibold text-white">
        {img.model}
      </span>
      {img.usage > 0 ? (
        <span className="theme-fixed absolute top-1 left-1 rounded-full bg-emerald-500 px-1.5 text-[9px] font-bold text-white">{img.usage} produit{img.usage > 1 ? 's' : ''}</span>
      ) : (
        <button
          onClick={del}
          disabled={busy}
          className="theme-fixed absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Supprimer la photo"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
      {error && <p className="text-[10px] text-red-400 mt-0.5 line-clamp-2">{error}</p>}
    </div>
  );
}
