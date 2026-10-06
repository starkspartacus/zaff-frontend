'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  Boxes,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Tag,
  AlertTriangle,
  Barcode,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function CatalogPage() {
  const { establishment } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Form fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [resellerPrice, setResellerPrice] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [minStockThreshold, setMinStockThreshold] = useState<number>(3);
  const [hasSerialNumbers, setHasSerialNumbers] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes, brandRes] = await Promise.allSettled([
        api.get('/products'),
        api.get('/categories'),
        api.get('/brands'),
      ]);

      if (prodRes.status === 'fulfilled' && Array.isArray(prodRes.value)) {
        setProducts(prodRes.value);
      }
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value)) {
        setCategories(catRes.value);
      }
      if (brandRes.status === 'fulfilled' && Array.isArray(brandRes.value)) {
        setBrands(brandRes.value);
      }
    } catch (e) {
      console.error('Error fetching catalog data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (val: number) => `${(val || 0).toLocaleString('fr-FR')} ${currency}`;

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setBarcode('');
    setCategoryId(categories[0]?._id || '');
    setBrandId(brands[0]?._id || '');
    setPurchasePrice(0);
    setPrice(0);
    setResellerPrice(0);
    setStockQuantity(10);
    setMinStockThreshold(3);
    setHasSerialNumbers(false);
    setIsModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku);
    setBarcode(p.barcode || '');
    setCategoryId(p.categoryId || '');
    setBrandId(p.brandId || '');
    setPurchasePrice(p.purchasePrice || 0);
    setPrice(p.price || 0);
    setResellerPrice(p.resellerPrice || 0);
    setStockQuantity(p.stockQuantity || 0);
    setMinStockThreshold(p.minStockThreshold || 3);
    setHasSerialNumbers(p.hasSerialNumbers || false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        sku,
        barcode: barcode || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        purchasePrice: Number(purchasePrice) || 0,
        price: Number(price) || 0,
        resellerPrice: Number(resellerPrice) || 0,
        stockQuantity: Number(stockQuantity) || 0,
        minStockThreshold: Number(minStockThreshold) || 3,
        hasSerialNumbers,
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct._id}`, payload);
      } else {
        await api.post('/products', payload);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to save product:', err);
      alert(err.response?.data?.message || 'Erreur lors de lenregistrement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCat === 'all' || p.categoryId === selectedCat;
    const q = search.toLowerCase();
    const matchesQuery =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#d4a017]" />
            Catalogue High-Tech
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gérez vos références d'appareils, pièces de rechange, accessoires et tarifs
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
            className="px-4 py-2 bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shrink-0 shadow-md shadow-[#d4a017]/20"
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
              ? 'bg-[#d4a017] text-black font-semibold'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Toutes catégories ({products.length})
        </button>
        {categories.map((c) => (
          <button
            key={c._id}
            onClick={() => setSelectedCat(c._id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCat === c._id
                ? 'bg-[#d4a017] text-black font-semibold'
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
                <th className="py-3.5 px-4">Prix d'Achat</th>
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
                    <div className="w-6 h-6 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
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
                  const isLow = p.stockQuantity <= (p.minStockThreshold || 3);
                  const isOut = p.stockQuantity <= 0;

                  return (
                    <tr key={p._id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{p.name}</div>
                        {p.hasSerialNumbers && (
                          <span className="text-[10px] text-[#d4a017] flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3" /> N° Série / IMEI requis
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-400">
                        <div>{p.sku}</div>
                        {p.barcode && <div className="text-[10px] text-neutral-600">{p.barcode}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400">
                        {formatPrice(p.purchasePrice)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {formatPrice(p.price)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#f5d77f]">
                        {formatPrice(p.resellerPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleSubmit}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-white">
              {editingProduct ? 'Modifier le Produit' : 'Nouveau Produit High-Tech'}
            </h2>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Désignation *</label>
                <Input
                  type="text"
                  placeholder="Ex: iPhone 15 Pro Max 256GB Titane"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Référence SKU *</label>
                  <Input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Code-barres EAN</label>
                  <Input
                    type="text"
                    placeholder="Scan ou saisie"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Catégorie</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a017] h-10"
                  >
                    <option value="">Sélectionner</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Marque</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a017] h-10"
                  >
                    <option value="">Sélectionner</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Prix d'Achat</label>
                  <Input
                    type="number"
                    value={purchasePrice || ''}
                    onChange={(e) => setPurchasePrice(Number(e.target.value) || 0)}
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Prix Détail *</label>
                  <Input
                    type="number"
                    value={price || ''}
                    onChange={(e) => setPrice(Number(e.target.value) || 0)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white font-bold text-[#f5d77f] rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Prix Revendeur</label>
                  <Input
                    type="number"
                    value={resellerPrice || ''}
                    onChange={(e) => setResellerPrice(Number(e.target.value) || 0)}
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Stock Initial / Actuel</label>
                  <Input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value) || 0)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Seuil Alerte Stock</label>
                  <Input
                    type="number"
                    value={minStockThreshold}
                    onChange={(e) => setMinStockThreshold(Number(e.target.value) || 3)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="hasSerialCheck"
                  checked={hasSerialNumbers}
                  onChange={(e) => setHasSerialNumbers(e.target.checked)}
                  className="w-4 h-4 accent-[#d4a017]"
                />
                <label htmlFor="hasSerialCheck" className="text-xs text-neutral-300">
                  Cet article nécessite un numéro de série / IMEI (Garantie activée à la vente)
                </label>
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
                Enregistrer l'Article
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
