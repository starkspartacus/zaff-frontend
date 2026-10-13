'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useReturnSaleItems } from '@/lib/queries';
import { errorMessage, type Sale } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Retour de marchandise (lot invendu d'un revendeur) : la valeur réduit d'abord le reste à payer */
export function ReturnModal({ sale, fmt, onClose }: { sale: Sale; fmt: (n: number) => string; onClose: () => void }) {
  const ret = useReturnSaleItems();
  // Une ligne par appareil (N° de série) ou par produit (quantité)
  const [qty, setQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'mobile' | 'none'>('cash');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const ratio = sale.subtotal ? sale.total / sale.subtotal : 1;
  const value = sale.items.reduce((n, it, i) => n + Math.round(it.unitPrice * (qty[i] || 0) * ratio), 0);
  const fromDebt = Math.min(value, sale.amountDue || 0);
  const refund = value - fromDebt;

  const submit = async () => {
    setError(null);
    const items = sale.items
      .map((it, i) => ({ productId: String(it.productId), quantity: qty[i] || 0, serialNumber: it.serialNumber || undefined }))
      .filter((x) => x.quantity > 0);
    if (!items.length) return setError('Choisissez les articles rapportés.');
    try {
      const res = await ret.mutateAsync({ saleId: sale._id, items, reason: reason.trim() || undefined, refundMethod: refund > 0 ? refundMethod : undefined });
      setResult(res.message);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85" onClick={(e) => e.stopPropagation()}>
      <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-4 relative max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 text-neutral-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
        <div>
          <h3 className="text-base font-bold text-white">Retour de marchandise · facture #{sale.invoiceNumber}</h3>
          <p className="text-xs text-neutral-400 mt-0.5">Les articles rapportés reviennent en stock.</p>
        </div>
        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-400">{result}</p>
            <button onClick={onClose} className="w-full h-10 rounded-xl bg-gold text-ink font-bold text-xs">
              Terminé
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {sale.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-800 p-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{it.productName}</p>
                    <p className="text-[11px] text-neutral-500">
                      {it.serialNumber ? `N° ${it.serialNumber}` : `${it.quantity} vendu(s)`} · {fmt(it.unitPrice)}
                    </p>
                  </div>
                  {it.serialNumber || it.quantity === 1 ? (
                    <input type="checkbox" checked={!!qty[i]} onChange={(e) => setQty((q) => ({ ...q, [i]: e.target.checked ? 1 : 0 }))} className="w-5 h-5 accent-gold" aria-label={`Retourner ${it.productName}`} />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={it.quantity}
                      value={qty[i] || ''}
                      onChange={(e) => setQty((q) => ({ ...q, [i]: Math.min(it.quantity, Math.max(0, Math.round(Number(e.target.value) || 0))) }))}
                      placeholder="0"
                      className="w-20 h-9 bg-neutral-900 border-neutral-800 text-white text-right rounded-lg"
                    />
                  )}
                </div>
              ))}
            </div>
            <Input type="text" placeholder="Motif (ex : lot invendu)" value={reason} onChange={(e) => setReason(e.target.value)} className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10" />
            {value > 0 && (
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-3 text-xs space-y-1">
                <p className="flex justify-between">
                  <span className="text-neutral-400">Valeur retournée</span> <span className="text-white font-bold">{fmt(value)}</span>
                </p>
                {fromDebt > 0 && (
                  <p className="flex justify-between">
                    <span className="text-neutral-400">Déduit du reste à payer</span> <span className="text-amber-400">{fmt(fromDebt)}</span>
                  </p>
                )}
                {refund > 0 && (
                  <>
                    <p className="flex justify-between">
                      <span className="text-neutral-400">Déjà payé, à rembourser</span> <span className="text-red-400">{fmt(refund)}</span>
                    </p>
                    <div className="flex gap-2 pt-1">
                      {(['cash', 'mobile', 'none'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setRefundMethod(m)}
                          className={cn('flex-1 h-8 rounded-lg border text-[11px] font-semibold', refundMethod === m ? 'bg-gold/15 border-gold text-gold-soft' : 'border-neutral-800 text-neutral-400')}
                        >
                          {m === 'cash' ? 'Espèces' : m === 'mobile' ? 'Mobile Money' : 'Plus tard'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={submit} disabled={ret.isPending || value <= 0} className="w-full h-11 rounded-xl bg-gold text-ink font-bold text-sm disabled:opacity-40">
              Enregistrer le retour
            </button>
          </>
        )}
      </div>
    </div>
  );
}
