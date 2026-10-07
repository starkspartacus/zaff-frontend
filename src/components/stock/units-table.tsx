'use client';

import React, { useDeferredValue, useState } from 'react';
import { errorMessage, type ProductUnit } from '@/lib/types';
import { useSetUnitStatus, useUnits } from '@/lib/queries';

const STATUS: Record<string, { label: string; cls: string }> = {
  in_stock: { label: 'En stock', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  sold: { label: 'Vendu', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  defective: { label: 'Défectueux', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const date = (d?: string | null) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Traçabilité appareil par appareil (N° de série / IMEI) */
export function UnitsTable({ search, canManage }: { search: string; canManage: boolean }) {
  const [status, setStatus] = useState('all');
  // La recherche suit la frappe sans bloquer l'affichage ; React Query met les résultats en cache
  const q = useDeferredValue(search.trim());
  const filters: Record<string, string> = { status, limit: '300', ...(q ? { search: q } : {}) };
  const { data: units = [], isLoading } = useUnits(filters);
  const setUnitStatusMutation = useSetUnitStatus();

  const setUnitStatus = async (u: ProductUnit, next: 'in_stock' | 'defective') => {
    const notes = next === 'defective' ? prompt('Motif (facultatif) :', '') ?? undefined : undefined;
    try {
      await setUnitStatusMutation.mutateAsync({ id: u._id, status: next, notes: notes || undefined });
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'Tous' },
          { id: 'in_stock', label: 'En stock' },
          { id: 'sold', label: 'Vendus' },
          { id: 'defective', label: 'Défectueux' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
              status === f.id ? 'bg-[#d4a017] text-black' : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-[11px] text-neutral-500 ml-auto whitespace-nowrap">Recherche par N° de série dans le champ « Filtrer »</span>
      </div>

      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">N° de série / IMEI</th>
                <th className="py-3.5 px-4">Appareil</th>
                <th className="py-3.5 px-4 text-center">Statut</th>
                <th className="py-3.5 px-4">Mis en stock</th>
                <th className="py-3.5 px-4">Vente</th>
                {canManage && <th className="py-3.5 px-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">Chargement…</td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">Aucun appareil dans cette vue.</td>
                </tr>
              ) : (
                units.map((u) => {
                  const p: Partial<NonNullable<ProductUnit['productId']>> = u.productId || {};
                  const st = STATUS[u.status] || { label: u.status, cls: 'bg-neutral-800 text-neutral-400 border-neutral-700' };
                  return (
                    <tr key={u._id} className="hover:bg-neutral-900/40">
                      <td className="py-3 px-4 font-mono font-semibold text-white">{u.serialNumber}</td>
                      <td className="py-3 px-4">
                        <div className="text-white">{p.name || 'Produit supprimé'}</div>
                        <div className="text-[10px] text-neutral-500">{[p.brand, p.model, p.color].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="py-3 px-4 text-neutral-400">
                        {date(u.createdAt)}
                        <div className="text-[10px] text-neutral-500">{u.addedByName || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-neutral-400">
                        {u.status === 'sold' ? (
                          <>
                            #{u.invoiceNumber} · {date(u.soldAt)}
                            <div className="text-[10px] text-neutral-500">{u.soldByName || '—'}</div>
                          </>
                        ) : (
                          u.notes || '—'
                        )}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-center">
                          {u.status === 'in_stock' && (
                            <button onClick={() => setUnitStatus(u, 'defective')} className="text-[11px] text-neutral-400 hover:text-red-400">
                              Mettre de côté
                            </button>
                          )}
                          {u.status === 'defective' && (
                            <button onClick={() => setUnitStatus(u, 'in_stock')} className="text-[11px] text-neutral-400 hover:text-emerald-400">
                              Remettre en vente
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
