'use client';

import { useState } from 'react';
import { Printer, Settings2 } from 'lucide-react';
import { errorMessage } from '@/lib/types';
import { loadReceiptSettings, openReceiptWindow, printReceipt, saveReceiptSettings, type ReceiptSettings } from './receipt';

/** Réglages du ticket mémorisés sur cet appareil */
export function useReceiptSettings() {
  const [settings, setSettings] = useState<ReceiptSettings>(() => loadReceiptSettings());
  const update = (patch: Partial<ReceiptSettings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveReceiptSettings(next);
      return next;
    });
  return [settings, update] as const;
}

/**
 * Prépare l'impression automatique : à appeler au clic de « Valider la vente » (avant l'appel au serveur),
 * sinon la fenêtre serait bloquée. Renvoie la fenêtre, ou null si l'impression automatique est désactivée.
 */
export function prepareAutoReceipt(): Window | null {
  if (!loadReceiptSettings().auto) return null;
  try {
    return openReceiptWindow();
  } catch {
    return null;
  }
}

/** Bouton « Imprimer le ticket » + réglages de l'imprimante (largeur du rouleau, copies, impression automatique) */
export function ReceiptButton({ saleId, className = '', compact = false }: { saleId: string; className?: string; compact?: boolean }) {
  const [settings, update] = useReceiptSettings();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const print = async () => {
    setError('');
    let win: Window;
    try {
      win = openReceiptWindow();
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    setBusy(true);
    try {
      await printReceipt(saleId, settings, win);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-[11px] font-bold border ${active ? 'bg-gold text-ink border-gold' : 'border-neutral-700 text-neutral-300'}`;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={print}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-bold flex items-center justify-center gap-2 hover:border-gold disabled:opacity-60"
        >
          <Printer className="w-4 h-4 text-gold" /> {busy ? 'Préparation…' : compact ? `Ticket ${settings.width} mm` : `Imprimer le ticket (${settings.width} mm)`}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Réglages du ticket"
          aria-expanded={open}
          className={`px-3 rounded-xl border text-neutral-300 hover:text-white ${open ? 'border-gold' : 'border-neutral-700'}`}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2.5 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-400">Rouleau</span>
            <div className="flex gap-1.5">
              {([58, 80] as const).map((w) => (
                <button key={w} type="button" className={chip(settings.width === w)} onClick={() => update({ width: w })}>
                  {w} mm
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-400">Exemplaires</span>
            <div className="flex gap-1.5">
              <button type="button" className={chip(settings.copies === 1)} onClick={() => update({ copies: 1 })}>
                1
              </button>
              <button type="button" className={chip(settings.copies === 2)} onClick={() => update({ copies: 2 })}>
                2 (client + boutique)
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-neutral-300">
            <input type="checkbox" className="w-4 h-4 accent-gold" checked={settings.auto} onChange={(e) => update({ auto: e.target.checked })} />
            Imprimer automatiquement après chaque vente
          </label>
          <p className="text-[10px] text-neutral-500">
            Réglé pour cet appareil. Dans la fenêtre d&apos;impression, choisissez l&apos;imprimante thermique et des marges « Aucune ».
          </p>
        </div>
      )}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
