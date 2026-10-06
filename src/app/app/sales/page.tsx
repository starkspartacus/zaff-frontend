'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Barcode,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  Printer,
  X,
  UserPlus,
  Tag,
  Boxes,
  Percent,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SalesPosPage() {
  const { establishment, user } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isResellerPricing, setIsResellerPricing] = useState(false);

  // Cart state
  const [cart, setCart] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [discount, setDiscount] = useState<number>(0);

  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_money' | 'bank_transfer'>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);

  // New Customer modal
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustIsReseller, setNewCustIsReseller] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [prodRes, catRes, custRes] = await Promise.allSettled([
        api.get('/products'),
        api.get('/categories'),
        api.get('/customers'),
      ]);

      if (prodRes.status === 'fulfilled' && Array.isArray(prodRes.value)) {
        setProducts(prodRes.value);
      }
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value)) {
        setCategories(catRes.value);
      }
      if (custRes.status === 'fulfilled' && Array.isArray(custRes.value)) {
        setCustomers(custRes.value);
      }
    } catch (e) {
      console.error('Error loading POS data:', e);
    }
  };

  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (val: number) => `${(val || 0).toLocaleString('fr-FR')} ${currency}`;

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Add to cart
  const addToCart = (product: any) => {
    const existingIndex = cart.findIndex((item) => item.product._id === product._id);
    const unitPrice = isResellerPricing && product.resellerPrice ? product.resellerPrice : product.price;

    if (existingIndex > -1) {
      const updated = [...cart];
      if (updated[existingIndex].quantity < product.stockQuantity) {
        updated[existingIndex].quantity += 1;
        setCart(updated);
      }
    } else {
      if (product.stockQuantity > 0) {
        setCart([
          ...cart,
          {
            product,
            quantity: 1,
            unitPrice,
            serialNumbers: [],
          },
        ]);
      }
    }
  };

  // Update line quantity
  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else if (newQty <= updated[index].product.stockQuantity) {
      updated[index].quantity = newQty;
    }
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  // Re-calculate prices when switching pricing mode
  const handleToggleReseller = (reseller: boolean) => {
    setIsResellerPricing(reseller);
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        unitPrice:
          reseller && item.product.resellerPrice
            ? item.product.resellerPrice
            : item.product.price,
      }))
    );
  };

  // Cart computations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const total = Math.max(0, subtotal - (discount || 0));
  const changeToReturn = Math.max(0, (amountPaid || 0) - total);

  // Quick Customer Creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) return;

    try {
      const created: any = await api.post('/customers', {
        name: newCustName,
        phone: newCustPhone,
        isReseller: newCustIsReseller,
      });
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomer(created);
      if (created.isReseller) {
        handleToggleReseller(true);
      }
      setIsNewCustomerOpen(false);
      setNewCustName('');
      setNewCustPhone('');
    } catch (err) {
      console.error('Error creating customer:', err);
    }
  };

  // Open checkout
  const handleOpenCheckout = () => {
    setAmountPaid(total);
    setIsCheckoutOpen(true);
  };

  // Submit sale
  const handleFinalizeSale = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer?._id || undefined,
        customerName: selectedCustomer?.name || 'Client Comptant',
        customerPhone: selectedCustomer?.phone || undefined,
        items: cart.map((item) => ({
          productId: item.product._id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          purchasePrice: item.product.purchasePrice || 0,
          totalPrice: item.unitPrice * item.quantity,
          serialNumbers: item.serialNumbers || [],
        })),
        paymentMethod,
        discount: Number(discount) || 0,
        paidAmount: Number(amountPaid) || total,
      };

      const result: any = await api.post('/sales', payload);

      setCompletedSale(result);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#d4a017', '#e5b83b', '#ffffff'],
      });

      // Reset cart
      setCart([]);
      setDiscount(0);
      fetchInitialData(); // reload stock
    } catch (err: any) {
      console.error('Failed to submit sale:', err);
      alert(err.response?.data?.message || 'Erreur lors de lencaissement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto select-none">
      {/* LEFT: Products selection */}
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-950/60 border border-neutral-800/80 rounded-3xl p-5 overflow-hidden">
        {/* Top Controls: Search & Category Filter */}
        <div className="space-y-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <Input
                type="text"
                placeholder="Rechercher produit, code-barres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 rounded-xl h-10"
              />
            </div>

            {/* Mode Tarif Switch */}
            <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800 self-stretch sm:self-auto justify-center">
              <button
                type="button"
                onClick={() => handleToggleReseller(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  !isResellerPricing
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Tarif Détail
              </button>
              <button
                type="button"
                onClick={() => handleToggleReseller(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isResellerPricing
                    ? 'bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Tarif Revendeur (Gros)
              </button>
            </div>
          </div>

          {/* Categories Pill Scroller */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#d4a017] text-black font-semibold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Tous ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelectedCategory(c._id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === c._id
                    ? 'bg-[#d4a017] text-black font-semibold'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 scrollbar-thin scrollbar-thumb-neutral-800">
          {filteredProducts.map((p) => {
            const isOutOfStock = p.stockQuantity <= 0;
            const displayPrice = isResellerPricing && p.resellerPrice ? p.resellerPrice : p.price;

            return (
              <button
                key={p._id}
                disabled={isOutOfStock}
                onClick={() => addToCart(p)}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all group ${
                  isOutOfStock
                    ? 'bg-neutral-900/30 border-neutral-800/40 opacity-50 cursor-not-allowed'
                    : 'bg-neutral-900/70 hover:bg-neutral-900 border-neutral-800/80 hover:border-[#d4a017]/60 hover:shadow-lg hover:shadow-[#d4a017]/5 active:scale-[0.98]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-neutral-400 truncate max-w-[100px]">
                      {p.sku || 'SKU'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        isOutOfStock
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : p.stockQuantity <= (p.minStockThreshold || 3)
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {isOutOfStock ? 'Épuisé' : `${p.stockQuantity} dispo`}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-white group-hover:text-[#f5d77f] transition-colors line-clamp-2">
                    {p.name}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-neutral-800/60 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#f5d77f]">
                    {formatPrice(displayPrice)}
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-[#d4a017]/10 text-[#d4a017] group-hover:bg-[#d4a017] group-hover:text-black flex items-center justify-center transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Cart & Checkout Panel */}
      <div className="w-full lg:w-96 flex flex-col bg-neutral-950/80 border border-neutral-800/80 rounded-3xl p-5 shadow-2xl">
        {/* Customer Selector */}
        <div className="pb-4 border-b border-neutral-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 font-medium">Client assigné</span>
            <button
              onClick={() => setIsNewCustomerOpen(true)}
              className="text-[#d4a017] hover:underline flex items-center gap-1 font-medium"
            >
              <UserPlus className="w-3 h-3" /> Nouveau
            </button>
          </div>

          <select
            value={selectedCustomer?._id || ''}
            onChange={(e) => {
              const cust = customers.find((c) => c._id === e.target.value);
              setSelectedCustomer(cust || null);
              if (cust?.isReseller) {
                handleToggleReseller(true);
              }
            }}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a017]"
          >
            <option value="">Client Comptant (Passage)</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {c.isReseller ? '? (Revendeur)' : ''} ({c.phone})
              </option>
            ))}
          </select>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 scrollbar-thin scrollbar-thumb-neutral-800">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <ShoppingCart className="w-10 h-10 mb-2 stroke-[1.5] text-neutral-600" />
              <p className="text-xs">Panier vide</p>
              <p className="text-[11px] text-neutral-600 mt-1">
                Touchez un produit pour l'ajouter à l'encaissement
              </p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/60 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{item.product.name}</p>
                  <p className="text-[11px] text-[#f5d77f]">
                    {formatPrice(item.unitPrice)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-neutral-800 rounded-xl p-1 border border-neutral-700">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-5 h-5 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-5 h-5 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(idx)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Totals & Checkout Button */}
        <div className="pt-4 border-t border-neutral-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Sous-total HT</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-[#d4a017]" /> Remise ({currency})
            </span>
            <input
              type="number"
              min="0"
              value={discount || ''}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-24 text-right bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#d4a017]"
            />
          </div>

          <div className="pt-2 border-t border-neutral-800 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-white">Total Net</span>
            <span className="text-2xl font-black text-[#f5d77f] tracking-tight">
              {formatPrice(total)}
            </span>
          </div>

          <GlowButton
            disabled={cart.length === 0}
            onClick={handleOpenCheckout}
            glowColor="rgba(212, 160, 23, 0.4)"
            className="w-full h-12 bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-extrabold rounded-2xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#d4a017]/20"
          >
            <Banknote className="w-4 h-4" />
            Encaisser ({formatPrice(total)})
          </GlowButton>
        </div>
      </div>

      {/* CHECKOUT & PAYMENT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative">
            <button
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-xl font-bold text-white">Finaliser l'Encaissement</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Client: {selectedCustomer?.name || 'Client Comptant'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#d4a017]/10 border border-[#d4a017]/30 text-center">
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                Montant total à percevoir
              </span>
              <p className="text-3xl font-black text-[#f5d77f] mt-1">
                {formatPrice(total)}
              </p>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300">Mode de règlement</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash', label: 'Espèces', icon: Banknote },
                  { id: 'mobile_money', label: 'Wave / MoMo', icon: Smartphone },
                  { id: 'card', label: 'Carte Bancaire', icon: CreditCard },
                  { id: 'bank_transfer', label: 'Virement', icon: Barcode },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                        paymentMethod === m.id
                          ? 'bg-[#d4a017]/15 border-[#d4a017] text-[#f5d77f]'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash specific: Received amount & Change */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Montant remis par le client ({currency})
                  </label>
                  <Input
                    type="number"
                    value={amountPaid || ''}
                    onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                    className="bg-neutral-900 border-neutral-800 text-white font-bold text-base h-11 rounded-xl"
                  />
                </div>

                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Monnaie à rendre :</span>
                  <span className="text-base font-bold text-emerald-400">
                    {formatPrice(changeToReturn)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleFinalizeSale}
              disabled={isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-extrabold rounded-2xl hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#d4a017]/20"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Valider et Imprimer Ticket
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* COMPLETED SALE / TICKET DIALOG */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-5 text-center relative">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Vente Enregistrée !</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Facture N° <span className="text-white font-mono">{completedSale.invoiceNumber}</span>
              </p>
            </div>

            {/* Thermal ticket preview (80mm representation) */}
            <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 font-mono text-[11px] text-left text-neutral-300 space-y-2">
              <div className="text-center font-bold text-white border-b border-neutral-800 pb-2">
                {establishment?.name || 'Zaff'}
                <div className="text-[10px] text-neutral-500 font-normal">
                  {establishment?.slug}
                </div>
              </div>

              <div className="space-y-1 py-1 border-b border-neutral-800">
                {completedSale.items?.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {it.quantity}x {it.productName}
                    </span>
                    <span>{formatPrice(it.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-bold text-white pt-1">
                <span>TOTAL PAYÉ:</span>
                <span>{formatPrice(completedSale.totalAmount)}</span>
              </div>
              <div className="text-[10px] text-neutral-500 text-center pt-2">
                Merci de votre visite et à bientôt !
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold hover:border-[#d4a017] transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4 text-[#d4a017]" /> Imprimer
              </button>
              <button
                onClick={() => {
                  setCompletedSale(null);
                  setIsCheckoutOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#d4a017] text-black text-xs font-bold hover:brightness-110 transition-all"
              >
                Nouvelle Vente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK NEW CUSTOMER MODAL */}
      {isNewCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form
            onSubmit={handleCreateCustomer}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setIsNewCustomerOpen(false)}
              className="absolute top-4 right-4 p-1 text-neutral-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white">Ajouter un Client</h3>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Nom complet *</label>
              <Input
                type="text"
                placeholder="Ex: Ibrahim Touré"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                required
                className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Numéro de téléphone *</label>
              <Input
                type="tel"
                placeholder="+225 07..."
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                required
                className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isResellerCheck"
                checked={newCustIsReseller}
                onChange={(e) => setNewCustIsReseller(e.target.checked)}
                className="w-4 h-4 accent-[#d4a017]"
              />
              <label htmlFor="isResellerCheck" className="text-xs text-neutral-300">
                Client Revendeur (Tarif Grossiste)
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#d4a017] text-black font-bold text-xs hover:brightness-110 transition-all mt-2"
            >
              Enregistrer Client
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
