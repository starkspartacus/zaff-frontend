'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { createDevice, deleteDevice, updateDevice, useAdminCategories, useAdminRefresh, type AdminDevice } from '@/lib/admin-api';
import { errorMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Création / modification d'un appareil du catalogue global */
export function DeviceEditorModal({ device, onClose }: { device?: AdminDevice; onClose: () => void }) {
  const router = useRouter();
  const refresh = useAdminRefresh();
  const categories = useAdminCategories().data ?? [];
  const [category, setCategory] = useState(device?.category || '');
  const [brand, setBrand] = useState(device?.brand || '');
  const [model, setModel] = useState(device?.model || '');
  const [variants, setVariants] = useState<string[]>(device?.variants || []);
  const [colors, setColors] = useState<string[]>(device?.colors || []);
  const [active, setActive] = useState(device?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (!category || !brand.trim() || !model.trim()) return setError('Catégorie, marque et modèle sont obligatoires.');
    setBusy(true);
    try {
      const dto = { category, brand: brand.trim(), model: model.trim(), variants, colors, active };
      const saved = device ? await updateDevice(device.id, dto) : await createDevice(dto);
      await refresh();
      onClose();
      if (!device) router.push(`/admin/device?id=${saved.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!device || !window.confirm(`Supprimer « ${device.brand} ${device.model} » et ses photos ? Les produits des boutiques qui l'utilisent gardent leur photo.`)) return;
    setBusy(true);
    try {
      await deleteDevice(device.id);
      await refresh();
      router.push('/admin/devices');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-neutral-950 border border-neutral-800 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{device ? "Modifier l'appareil" : 'Nouvel appareil'}</h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-neutral-300">Catégorie</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCategory(c.slug)}
                className={cn('h-9 px-3 rounded-xl border text-xs font-semibold', category === c.slug ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400')}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marque" value={brand} onChange={setBrand} placeholder="Samsung" />
          <Field label="Modèle" value={model} onChange={setModel} placeholder="Galaxy A56 5G" />
        </div>
        <ChipsField label="Capacités / configurations" values={variants} onChange={setVariants} placeholder="128 Go, 256 Go…" />
        <ChipsField label="Coloris officiels" values={colors} onChange={setColors} placeholder="Noir, Bleu glacé…" />
        <label className="flex items-center justify-between rounded-2xl border border-neutral-800 px-4 py-3 cursor-pointer">
          <span className="text-sm text-white">Visible par les boutiques</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-5 h-5 accent-[var(--color-gold)]" />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          {device && (
            <button onClick={remove} disabled={busy} className="h-12 px-4 rounded-2xl border border-red-500/40 text-red-400 text-sm font-semibold flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
          )}
          <button onClick={save} disabled={busy} className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <Check className="w-4 h-4" /> {device ? 'Enregistrer' : "Créer l'appareil"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-neutral-300">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={120} className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold" />
    </label>
  );
}

/** Liste de valeurs en pastilles (Entrée ou virgule pour ajouter) */
export function ChipsField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(',').map((v) => v.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...values, ...parts])].slice(0, 40));
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-neutral-300">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="h-8 pl-3 pr-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-white flex items-center gap-1">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="w-6 h-6 rounded-full text-neutral-500 hover:text-red-400 flex items-center justify-center" aria-label={`Retirer ${v}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold"
        />
        <button type="button" onClick={add} className="h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>
    </div>
  );
}
