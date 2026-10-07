'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { UnitsTable } from '@/components/stock/units-table';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  Layers,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  RotateCcw,
  X,
  Boxes,
  FileSpreadsheet,
} from 'lucide-react';

export default function StockPage() {
  const { establishment, user } = useAuth();
  const canManage = user?.role !== 'seller';
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'levels' | 'units' | 'history'>('levels');
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [type, setType] = useState<'in' | 'out' | 'adjustment' | 'loss'>('in');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, movRes] = await Promise.allSettled([
        api.get('/catalog/products'),
        api.get('/stock/movements'),
      ]);

      if (prodRes.status === 'fulfilled' && Array.isArray(prodRes.value)) {
        setProducts(prodRes.value);
      }
      if (movRes.status === 'fulfilled' && Array.isArray(movRes.value)) {
        setMovements(movRes.value);
      }
    } catch (e) {
      console.error('Error fetching stock data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    try {
      // « Perte / Casse » est une sortie de stock dont le motif est tracé
      const isLoss = type === 'loss';
      await api.post('/stock/movements', {
        productId: selectedProductId,
        movementType: isLoss ? 'out' : type,
        quantity: Number(quantity),
        referenceType: type === 'adjustment' ? 'adjustment' : 'manual',
        notes: isLoss ? `Perte / Casse${reason ? ` : ${reason}` : ''}` : reason || undefined,
      });

      setIsModalOpen(false);
      setSelectedProductId('');
      setQuantity(1);
      setReason('');
      fetchStockData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du mouvement de stock');
    }
  };

  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (val: number) => `${(val || 0).toLocaleString('fr-FR')} ${currency}`;

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  });

  const lowStockCount = products.filter((p) => p.stockQuantity <= (p.minStockAlert ?? 3)).length;
  const totalStockValue = products.reduce((sum, p) => sum + (p.purchasePrice || 0) * (p.stockQuantity || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#d4a017]" />
            Gestion des Niveaux & Mouvements de Stock
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Contrôlez les réserves, saisissez les entrées/sorties et ajustements d'inventaire
          </p>
        </div>

        {canManage && (
        <div className="flex items-center gap-3">
          <GlowButton
            onClick={() => {
              setSelectedProductId(products.find((p) => !p.hasSerialNumbers)?._id || '');
              setIsModalOpen(true);
            }}
            glowColor="rgba(212, 160, 23, 0.4)"
            className="px-4 py-2 bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shadow-md shadow-[#d4a017]/20"
          >
            <Plus className="w-4 h-4" />
            Mouvement (sans N° de série)
          </GlowButton>
        </div>
        )}
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800/80">
          <span className="text-xs text-neutral-400">Total Références</span>
          <p className="text-2xl font-bold text-white mt-1">{products.length} articles</p>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800/80">
          <span className="text-xs text-neutral-400">Articles en Stock Bas</span>
          <p className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {lowStockCount} alertes
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800/80">
          <span className="text-xs text-neutral-400">Valeur d'Achat du Stock</span>
          <p className="text-2xl font-bold text-[#f5d77f] mt-1">{formatPrice(totalStockValue)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('levels')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'levels'
                ? 'bg-[#d4a017] text-black'
                : 'text-neutral-400 hover:text-white bg-neutral-900'
            }`}
          >
            Niveaux de Stock Actuels
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'units'
                ? 'bg-[#d4a017] text-black'
                : 'text-neutral-400 hover:text-white bg-neutral-900'
            }`}
          >
            Numéros de série
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-[#d4a017] text-black'
                : 'text-neutral-400 hover:text-white bg-neutral-900'
            }`}
          >
            Historique des Mouvements ({movements.length})
          </button>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <Input
            type="text"
            placeholder="Filtrer article..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-neutral-900 border-neutral-800 text-white rounded-xl h-9 text-xs"
          />
        </div>
      </div>

      {/* Content based on tab */}
      {activeTab === 'units' ? (
        <UnitsTable search={search} canManage={canManage} />
      ) : activeTab === 'levels' ? (
        <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Désignation</th>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Prix Achat</th>
                  <th className="py-3.5 px-4 text-center">Seuil Min</th>
                  <th className="py-3.5 px-4 text-center">Quantité Actuelle</th>
                  <th className="py-3.5 px-4 text-right">Valeur Stock</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {filteredProducts.map((p) => {
                  const isLow = p.stockQuantity <= (p.minStockAlert ?? 3);
                  const isOut = p.stockQuantity <= 0;

                  return (
                    <tr key={p._id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">{p.name}</td>
                      <td className="py-3.5 px-4 font-mono text-neutral-400">{p.sku}</td>
                      <td className="py-3.5 px-4 text-neutral-400">{formatPrice(p.purchasePrice)}</td>
                      <td className="py-3.5 px-4 text-center text-neutral-400">{p.minStockAlert ?? 3}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-white text-sm">
                        {p.stockQuantity}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#f5d77f]">
                        {formatPrice((p.purchasePrice || 0) * (p.stockQuantity || 0))}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isOut
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : isLow
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {isOut ? 'Rupture' : isLow ? 'Faible' : 'Optimal'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Date & Heure</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Produit</th>
                  <th className="py-3.5 px-4 text-center">Quantité</th>
                  <th className="py-3.5 px-4">Motif / Justificatif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-500">
                      Aucun mouvement de stock enregistré.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m._id} className="hover:bg-neutral-900/40">
                      <td className="py-3.5 px-4 text-neutral-400">
                        {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            m.movementType === 'in'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : m.movementType === 'out'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {m.movementType === 'in' ? 'Entrée (+)' : m.movementType === 'out' ? 'Sortie (-)' : 'Ajustement'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {m.productId?.name || 'Article supprimé'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-white">
                        {m.movementType === 'in' ? `+${m.quantity}` : m.movementType === 'adjustment' ? `= ${m.quantity}` : `-${m.quantity}`}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400 italic">
                        {m.notes || 'Mouvement standard'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW MOVEMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleRecordMovement}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-white">Enregistrer un Mouvement</h2>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Article concerné *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a017] h-10"
                >
                  <option value="">Sélectionner un produit</option>
                  {products.filter((p) => !p.hasSerialNumbers).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (Stock actuel: {p.stockQuantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Type d'opération *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'in', label: 'Entrée Stock (+)' },
                    { id: 'out', label: 'Sortie Stock (-)' },
                    { id: 'adjustment', label: 'Ajustement Inventaire' },
                    { id: 'loss', label: 'Perte / Casse' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                        type === t.id
                          ? 'bg-[#d4a017]/15 border-[#d4a017] text-[#f5d77f]'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  {type === 'adjustment' ? 'Nouvelle quantité réelle en stock *' : 'Quantité concernée *'}
                </label>
                <Input
                  type="number"
                  min={type === 'adjustment' ? '0' : '1'}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
                  required
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Motif / Justification</label>
                <Input
                  type="text"
                  placeholder="Ex: Réception commande fournisseur, inventaire fin de mois..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#d4a017] text-black font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-[#d4a017]/20"
              >
                Valider le Mouvement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
