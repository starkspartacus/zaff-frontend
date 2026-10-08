'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useCategories, useProducts } from '@/lib/queries';
import { errorMessage, type Product } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import { ProductForm } from '@/components/products/product-form';
import { ProductVisual } from '@/components/products/product-visual';
import {
  Boxes,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Sparkles,
  ScanLine,
} from 'lucide-react';

export default function CatalogPage() {
  const { establishment } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  // React Query : le stock se met à jour en direct (mise en stock, ventes, retours) grâce au temps réel
  const { data: products = [], isLoading } = useProducts();
  const categories = useCategories().data ?? [];
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const fetchData = () => queryClient.invalidateQueries({ queryKey: ['products'] });

  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (val?: number) => `${(val || 0).toLocaleString('fr-FR')} ${currency}`;

  const openCreateModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    try {
      await api.delete(`/catalog/products/${id}`);
      fetchData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCat === 'all' || p.category === selectedCat;
    const q = search.toLowerCase();
    const matchesQuery =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.model?.toLowerCase().includes(q) ||
      p.color?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-gold" />
            Catalogue High-Tech
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gérez vos références d&apos;appareils, pièces de rechange, accessoires et tarifs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input
              type="text"
              placeholder="Rechercher référence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 rounded-xl h-10"
            />
          </div>

          <GlowButton
            onClick={openCreateModal}
            glowColor="rgba(212, 160, 23, 0.4)"
            className="px-4 py-2 bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shrink-0 shadow-md shadow-gold/20"
          >
            <Plus className="w-4 h-4" />
            Ajouter Produit
          </GlowButton>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCat('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            selectedCat === 'all'
              ? 'bg-gold text-ink font-semibold'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Toutes catégories ({products.length})
        </button>
        {categories.map((c) => (
          <button
            key={c._id}
            onClick={() => setSelectedCat(c.slug)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCat === c.slug
                ? 'bg-gold text-ink font-semibold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Products Table */}
      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Article</th>
                <th className="py-3.5 px-4">SKU / Code-barres</th>
                <th className="py-3.5 px-4">Prix d&apos;Achat</th>
                <th className="py-3.5 px-4">Prix Détail</th>
                <th className="py-3.5 px-4">Prix Revendeur</th>
                <th className="py-3.5 px-4 text-center">Stock</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement du catalogue...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    Aucun produit trouvé dans cette sélection.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.stockQuantity <= (p.minStockAlert ?? 3);
                  const isOut = p.stockQuantity <= 0;

                  return (
                    <tr key={p._id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                        <ProductVisual imageId={p.imageId} category={p.category} brand={p.brand} size="thumb" name={p.name} className="w-12 h-12 shrink-0" rounded="rounded-xl" />
                        <div className="min-w-0">
                        <div className="font-semibold text-white">{p.name}</div>
                        {(p.brand || p.model || p.color) && (
                          <div className="text-[11px] text-neutral-400">
                            {[p.brand, p.model, p.color].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {p.hasSerialNumbers && (
                          <span className="text-[10px] text-gold flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3" /> Suivi par N° de série / IMEI
                          </span>
                        )}
                        </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-400">
                        <div>{p.sku}</div>
                        {p.barcode && <div className="text-[10px] text-neutral-600">{p.barcode}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400">
                        {formatPrice(p.purchasePrice)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {formatPrice(p.salePrice)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gold-soft">
                        {formatPrice(p.resellerPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isOut
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : isLow
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {p.stockQuantity} unités
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {p.hasSerialNumbers && (
                            <Link
                              href={`/app/receive?product=${p._id}`}
                              className="p-1.5 rounded-lg text-gold hover:bg-gold/10 transition-colors"
                              title="Mettre en stock : scanner les N° de série / IMEI"
                              aria-label={`Mettre en stock ${p.name}`}
                            >
                              <ScanLine className="w-4 h-4" />
                            </Link>
                          )}
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p._id)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl px-5 pt-5 pb-3 sm:px-7 max-w-2xl w-full shadow-2xl relative max-h-[94vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-xl font-bold text-white">{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</h2>
                <p className="text-xs text-neutral-500">Choisissez dans les listes ou tapez ce qui manque : tout est modifiable.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 text-neutral-400 hover:text-white" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ProductForm
              key={editingProduct?._id || 'new'}
              initial={editingProduct}
              onCancel={() => setIsModalOpen(false)}
              onSaved={(saved) => {
                setIsModalOpen(false);
                fetchData();
                // Nouveau produit à N° de série : son stock monte en scannant chaque appareil, on y va directement
                if (!editingProduct && saved.hasSerialNumbers) router.push(`/app/receive?product=${saved._id}`);
              }}
              onUseExisting={(p) => setEditingProduct(p)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
