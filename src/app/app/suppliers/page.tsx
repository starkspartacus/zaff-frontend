'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  Truck,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  Package,
  X,
  Boxes,
} from 'lucide-react';

export default function SuppliersPage() {
  const { establishment } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');
  const [isLoading, setIsLoading] = useState(true);

  // Modal Supplier
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supContactPerson, setSupContactPerson] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');

  // Modal Purchase Order
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSupplierId, setOrderSupplierId] = useState('');
  const [orderProductId, setOrderProductId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState<number>(10);
  const [orderUnitCost, setOrderUnitCost] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [supRes, orderRes, prodRes] = await Promise.allSettled([
        api.get('/suppliers'),
        api.get('/suppliers/orders'),
        api.get('/catalog/products'),
      ]);

      if (supRes.status === 'fulfilled' && Array.isArray(supRes.value)) {
        setSuppliers(supRes.value);
      }
      if (orderRes.status === 'fulfilled' && Array.isArray(orderRes.value)) {
        setPurchaseOrders(orderRes.value);
      }
      if (prodRes.status === 'fulfilled' && Array.isArray(prodRes.value)) {
        setProducts(prodRes.value);
      }
    } catch (e) {
      console.error('Error fetching suppliers data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (val: number) => `${(val || 0).toLocaleString('fr-FR')} ${currency}`;

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/suppliers', {
        name: supName,
        contactPerson: supContactPerson || undefined,
        phone: supPhone,
        email: supEmail || undefined,
        address: supAddress || undefined,
      });

      setIsSupplierModalOpen(false);
      setSupName('');
      setSupContactPerson('');
      setSupPhone('');
      setSupEmail('');
      setSupAddress('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la création du fournisseur');
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderSupplierId || !orderProductId) return;

    try {
      await api.post('/suppliers/orders', {
        supplierId: orderSupplierId,
        items: [
          {
            productId: orderProductId,
            quantity: Number(orderQuantity),
            unitPrice: Number(orderUnitCost),
            total: Number(orderQuantity) * Number(orderUnitCost),
          },
        ],
        totalAmount: Number(orderQuantity) * Number(orderUnitCost),
        status: 'pending',
      });

      setIsOrderModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la commande');
    }
  };

  const handleReceiveOrder = async (orderId: string) => {
    if (!confirm('Confirmez-vous la réception complète des marchandises en stock ?')) return;
    try {
      await api.patch(`/suppliers/orders/${orderId}/receive`, {});
      alert('Articles réceptionnés ! Les stocks ont été automatiquement incrémentés.');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la réception');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-gold" />
            Fournisseurs & Approvisionnements
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gérez vos grossistes, importateurs et commandes d'achat avec réception directe en stock
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:border-gold text-white text-xs font-semibold rounded-xl transition-all"
          >
            + Nouveau Fournisseur
          </button>
          <GlowButton
            onClick={() => {
              setOrderSupplierId(suppliers[0]?._id || '');
              setOrderProductId(products[0]?._id || '');
              setOrderUnitCost(products[0]?.purchasePrice || 0);
              setIsOrderModalOpen(true);
            }}
            glowColor="rgba(212, 160, 23, 0.4)"
            className="px-4 py-2 bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shadow-md shadow-gold/20"
          >
            <Plus className="w-4 h-4" />
            Créer Bon de Commande
          </GlowButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'suppliers'
              ? 'bg-gold text-ink'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Répertoire Fournisseurs ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'orders'
              ? 'bg-gold text-ink'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Bons de Commande & Réceptions ({purchaseOrders.length})
        </button>
      </div>

      {/* Tab 1: Suppliers */}
      {activeTab === 'suppliers' ? (
        <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Fournisseur</th>
                  <th className="py-3.5 px-4">Interlocuteur</th>
                  <th className="py-3.5 px-4">Téléphone</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Adresse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-500">
                      Aucun fournisseur enregistré.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s._id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">{s.name}</td>
                      <td className="py-3.5 px-4 text-neutral-300">{s.contactPerson || '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-neutral-300">{s.phone}</td>
                      <td className="py-3.5 px-4 text-neutral-400">{s.email || '—'}</td>
                      <td className="py-3.5 px-4 text-neutral-400">{s.address || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tab 2: Purchase Orders */
        <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">N° Commande</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Fournisseur</th>
                  <th className="py-3.5 px-4">Articles</th>
                  <th className="py-3.5 px-4 text-right">Montant Total</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-500">
                      Aucun bon de commande d'approvisionnement enregistré.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => {
                    const isReceived = po.status === 'received';
                    return (
                      <tr key={po._id} className="hover:bg-neutral-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-gold-soft">
                          {po.orderNumber || po._id.slice(-6).toUpperCase()}
                        </td>
                        <td className="py-3.5 px-4 text-neutral-400">
                          {new Date(po.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {po.supplierId?.name || 'Fournisseur'}
                        </td>
                        <td className="py-3.5 px-4 text-neutral-300">
                          {po.items?.map((it: any) => `${it.quantity}x ${it.productId?.name || 'Article'}`).join(', ')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-gold-soft">
                          {formatPrice(po.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isReceived
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {isReceived ? 'Réceptionné' : 'En attente livraison'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {!isReceived && (
                            <button
                              onClick={() => handleReceiveOrder(po._id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-[11px] font-semibold transition-all flex items-center gap-1 mx-auto"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Réceptionner
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE SUPPLIER MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleCreateSupplier}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setIsSupplierModalOpen(false)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-white">Nouveau Fournisseur</h2>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Raison Sociale / Nom *</label>
                <Input
                  type="text"
                  placeholder="Ex: Dubai Tech Imports"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  required
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Contact Référent</label>
                <Input
                  type="text"
                  placeholder="Ex: M. Ahmed"
                  value={supContactPerson}
                  onChange={(e) => setSupContactPerson(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Téléphone *</label>
                <Input
                  type="tel"
                  placeholder="+225 05..."
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  required
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="contact@supplier.com"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Adresse</label>
                <Input
                  type="text"
                  placeholder="Port de San Pedro / Abidjan Zone 4"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gold text-ink font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-gold/20"
              >
                Enregistrer Fournisseur
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleCreateOrder}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setIsOrderModalOpen(false)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-white">Créer un Bon de Commande</h2>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Fournisseur *</label>
                <select
                  value={orderSupplierId}
                  onChange={(e) => setOrderSupplierId(e.target.value)}
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold h-10"
                >
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Article à commander *</label>
                <select
                  value={orderProductId}
                  onChange={(e) => {
                    setOrderProductId(e.target.value);
                    const p = products.find((pr) => pr._id === e.target.value);
                    if (p) setOrderUnitCost(p.purchasePrice || 0);
                  }}
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold h-10"
                >
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Quantité *</label>
                  <Input
                    type="number"
                    min="1"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(Number(e.target.value) || 1)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Coût unitaire ({currency})</label>
                  <Input
                    type="number"
                    value={orderUnitCost || ''}
                    onChange={(e) => setOrderUnitCost(Number(e.target.value) || 0)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-neutral-400">Total Commande :</span>
                <span className="text-base font-bold text-gold-soft">
                  {formatPrice(orderQuantity * orderUnitCost)}
                </span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gold text-ink font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-gold/20"
              >
                Générer Bon de Commande
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
