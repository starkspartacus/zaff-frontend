'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useCategories, useCreateCustomer, useCreateSale, useCustomers, useProducts, useReturnPolicy } from '@/lib/queries';
import { PhoneInput } from '@/components/forms/geo-fields';
import { toE164 } from '@/lib/geo';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  FileSignature,
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
  X,
  UserPlus,
  Tag,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { prepareAutoReceipt, ReceiptButton } from '@/components/print/receipt-button';
import { printReceipt } from '@/components/print/receipt';
import { errorMessage, type Customer, type Product, type Sale, type ScanLookup } from '@/lib/types';

type PayMethod = 'cash' | 'card' | 'mobile' | 'bank_transfer' | 'credit';

interface CartLine {
  product: Product;
  quantity: number;
  unitPrice: number;
  serialNumber?: string;
}

/** Tarif revendeur pour un client revendeur (si le produit en a un), sinon prix de vente */
const priceFor = (p: Product, reseller: boolean) => (reseller && (p.resellerPrice || 0) > 0 ? p.resellerPrice! : p.salePrice);

export default function SalesPosPage() {
  const { establishment } = useAuth();

  // Lectures en direct (WebSocket) : stock, catégories et clients toujours à jour
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: customers = [] } = useCustomers('all');
  const createSale = useCreateSale();
  const createCustomer = useCreateCustomer();
  // Garantie par défaut de la boutique (même règle que les retours et le contrat)
  const { data: policy } = useReturnPolicy();
  const warrantyMonths = policy?.defective.defaultWarrantyMonths ?? 12;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Panier
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  // Le tarif revendeur s'applique seulement à un client enregistré comme revendeur
  const isResellerPricing = !!selectedCustomer?.isReseller;

  // Encaissement
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [deposit, setDeposit] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<'cash' | 'mobile'>('cash');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const isSubmitting = createSale.isPending;
  const [completedSale, setCompletedSale] = useState<(Sale & { change?: number }) | null>(null);

  // Produit à N° de série en attente de scan
  const [serialPicker, setSerialPicker] = useState<Product | null>(null);
  const [serialError, setSerialError] = useState<string | null>(null);

  // Nouveau client
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCountry, setNewCustCountry] = useState(establishment?.countryCode || 'CI');
  const [newCustIsReseller, setNewCustIsReseller] = useState(false);
  const [newCustError, setNewCustError] = useState<string | null>(null);

  // Les quantités et prix du panier suivent le stock et le tarif du client choisi
  const chooseCustomer = (cust: Customer | null) => {
    setSelectedCustomer(cust);
    setCart((prev) => prev.map((item) => ({ ...item, unitPrice: priceFor(item.product, !!cust?.isReseller) })));
    if (!cust && paymentMethod === 'credit') setPaymentMethod('cash');
  };

  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (val: number) => `${(val || 0).toLocaleString('fr-FR')} ${currency}`;

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Ajout d'un appareil précis (N° de série vérifié côté serveur)
  const addUnitToCart = (product: Product, serialNumber: string) => {
    if (cart.some((item) => item.serialNumber === serialNumber)) {
      throw new Error(`L'appareil ${serialNumber} est déjà dans le panier.`);
    }
    setCart((prev) => [...prev, { product, quantity: 1, unitPrice: priceFor(product, isResellerPricing), serialNumber }]);
  };

  const resolveScan = async (code: string, expectedProduct?: Product | null) => {
    const res = (await api.get(`/units/lookup/${encodeURIComponent(code)}`)) as unknown as ScanLookup;
    if (res.type === 'unit') {
      if (expectedProduct && String(res.product?._id) !== String(expectedProduct._id)) {
        throw new Error(`Ce N° de série correspond à « ${res.product?.name} », pas à « ${expectedProduct.name} ».`);
      }
      if (!res.sellable) {
        throw new Error(
          res.unit.status === 'sold'
            ? `L'appareil ${res.unit.serialNumber} est déjà vendu (facture #${res.unit.invoiceNumber}).`
            : `L'appareil ${res.unit.serialNumber} n'est pas disponible à la vente.`
        );
      }
      addUnitToCart(res.product, res.unit.serialNumber);
      return;
    }
    // Code-barres d'un modèle
    if (res.product.hasSerialNumbers) {
      throw new Error(`Code-barres du modèle « ${res.product.name} » : scannez le N° de série / IMEI de l'appareil.`);
    }
    addToCart(res.product);
  };

  // Scan (douchette) directement dans la barre de recherche
  const handleSearchEnter = async () => {
    const code = searchQuery.trim();
    if (!code) return;
    try {
      await resolveScan(code);
      scanFeedback(true);
      setSearchQuery('');
    } catch (err) {
      // Pas un code connu : la recherche texte reste affichée
      if (filteredProducts.length === 0) {
        scanFeedback(false);
        alert(errorMessage(err));
      }
    }
  };

  const handleSerialPicked = async (code: string) => {
    setSerialError(null);
    try {
      await resolveScan(code, serialPicker);
      scanFeedback(true);
      setSerialPicker(null);
    } catch (err) {
      scanFeedback(false);
      setSerialError(errorMessage(err));
    }
  };

  // Add to cart
  const addToCart = (product: Product) => {
    if (product.hasSerialNumbers) {
      // Chaque appareil est identifié : on demande son N° de série
      setSerialError(null);
      setSerialPicker(product);
      return;
    }
    setCart((prev) => {
      const i = prev.findIndex((item) => item.product._id === product._id && !item.serialNumber);
      if (i > -1) {
        if (prev[i].quantity >= product.stockQuantity) return prev;
        return prev.map((item, k) => (k === i ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return product.stockQuantity > 0 ? [...prev, { product, quantity: 1, unitPrice: priceFor(product, isResellerPricing) }] : prev;
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const item = prev[index];
      if (!item || (item.serialNumber && delta > 0)) return prev; // un N° de série = un appareil
      const qty = item.quantity + delta;
      if (qty <= 0) return prev.filter((_, k) => k !== index);
      // Stock à jour (temps réel) : on ne vend pas plus que ce qui est disponible
      const live = products.find((p) => p._id === item.product._id)?.stockQuantity ?? item.product.stockQuantity;
      return qty <= live ? prev.map((x, k) => (k === index ? { ...x, quantity: qty } : x)) : prev;
    });
  };

  const removeFromCart = (index: number) => setCart((prev) => prev.filter((_, k) => k !== index));

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  // Remise : jamais négative, jamais plus que le panier
  const safeDiscount = Math.min(Math.max(0, Math.round(discount || 0)), subtotal);
  const total = subtotal - safeDiscount;
  const changeToReturn = Math.max(0, (amountPaid || 0) - total);
  const missing = paymentMethod === 'cash' ? Math.max(0, total - (amountPaid || 0)) : 0;
  const safeDeposit = Math.min(Math.max(0, Math.round(deposit || 0)), total);
  const dueAfter = total - safeDeposit;
  const canValidate =
    cart.length > 0 && !isSubmitting && (paymentMethod === 'credit' ? !!selectedCustomer : paymentMethod !== 'cash' || missing === 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewCustError(null);
    if (!newCustName.trim()) return setNewCustError('Indiquez le nom du client.');
    const phone = newCustPhone ? toE164(newCustPhone, newCustCountry) : null;
    if (newCustPhone && !phone) return setNewCustError("Ce numéro n'est pas valide pour ce pays.");
    try {
      const created = await createCustomer.mutateAsync({ name: newCustName.trim(), phone: phone || undefined, isReseller: newCustIsReseller });
      chooseCustomer(created);
      setIsNewCustomerOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustIsReseller(false);
    } catch (err) {
      setNewCustError(errorMessage(err));
    }
  };

  const handleOpenCheckout = () => {
    setAmountPaid(total);
    setDeposit(0);
    setCheckoutError(null);
    setIsCheckoutOpen(true);
  };

  const handleFinalizeSale = async () => {
    if (!canValidate) return;
    setCheckoutError(null);
    // Impression automatique du ticket : fenêtre ouverte dès le clic (sinon bloquée par le navigateur)
    const receiptWin = prepareAutoReceipt();
    try {
      // Le serveur recalcule prix et totaux ; sans client choisi : vente comptant
      const withCustomer = !!selectedCustomer;
      const result = await createSale.mutateAsync({
        customerId: selectedCustomer?._id || undefined,
        items: cart.map((item) => ({
          productId: item.product._id,
          productName: item.product.name,
          productSku: item.product.sku || undefined,
          productCategory: item.product.category || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          serialNumber: item.serialNumber || undefined,
          // Garantie enregistrée pour un client connu (appareils à N° de série)
          warrantyEnabled: withCustomer && !!item.serialNumber,
          warrantyMonths: withCustomer && item.serialNumber ? warrantyMonths : 0,
        })),
        discount: safeDiscount,
        paidAmount: paymentMethod === 'cash' ? Number(amountPaid) || total : undefined,
        depositAmount: paymentMethod === 'credit' ? safeDeposit : undefined,
        depositMethod: paymentMethod === 'credit' && safeDeposit > 0 ? depositMethod : undefined,
        paymentMethod,
        saleType: isResellerPricing ? 'reseller' : 'purchase',
      });

      setCompletedSale({ ...result, change: paymentMethod === 'cash' ? changeToReturn : 0 });
      if (receiptWin) printReceipt(result._id, {}, receiptWin).catch(() => undefined);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#d4a017', '#e5b83b', '#ffffff'] });
      setCart([]);
      setDiscount(0);
      setIsCheckoutOpen(false);
    } catch (err) {
      receiptWin?.close();
      setCheckoutError(errorMessage(err));
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
                placeholder="Rechercher ou scanner (N° série, code-barres)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchEnter();
                  }
                }}
                className="pl-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 rounded-xl h-10"
              />
            </div>

            {/* Tarif : déterminé par le client choisi (un revendeur enregistré a le tarif revendeur) */}
            <div
              className={`self-stretch sm:self-auto px-3 py-2 rounded-xl border text-xs font-semibold text-center ${
                isResellerPricing ? 'bg-gold/15 border-gold/50 text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
              }`}
              title="Choisissez un client revendeur pour appliquer le tarif revendeur"
            >
              {isResellerPricing ? `Tarif revendeur · ${selectedCustomer?.name}` : 'Tarif détail'}
            </div>
          </div>

          {/* Categories Pill Scroller */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-gold text-ink font-semibold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Tous ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelectedCategory(c.slug)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === c.slug
                    ? 'bg-gold text-ink font-semibold'
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
            const displayPrice = priceFor(p, isResellerPricing);

            return (
              <button
                key={p._id}
                disabled={isOutOfStock}
                onClick={() => addToCart(p)}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all group ${
                  isOutOfStock
                    ? 'bg-neutral-900/30 border-neutral-800/40 opacity-50 cursor-not-allowed'
                    : 'bg-neutral-900/70 hover:bg-neutral-900 border-neutral-800/80 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/5 active:scale-[0.98]'
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
                          : p.stockQuantity <= (p.minStockAlert ?? 3)
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {isOutOfStock ? 'Épuisé' : `${p.stockQuantity} dispo`}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-white group-hover:text-gold-soft transition-colors line-clamp-2">
                    {p.name}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-neutral-800/60 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gold-soft">
                    {formatPrice(displayPrice)}
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-gold/10 text-gold group-hover:bg-gold group-hover:text-ink flex items-center justify-center transition-colors">
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
              className="text-gold hover:underline flex items-center gap-1 font-medium"
            >
              <UserPlus className="w-3 h-3" /> Nouveau
            </button>
          </div>

          <select
            value={selectedCustomer?._id || ''}
            onChange={(e) => chooseCustomer(customers.find((c) => c._id === e.target.value) || null)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold"
          >
            <option value="">Client de passage (comptant)</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {c.isReseller ? '· Revendeur' : ''}{c.phone ? ` (${c.phone})` : ''}{(c.balance || 0) > 0 ? ` · doit ${(c.balance || 0).toLocaleString('fr-FR')}` : ''}
              </option>
            ))}
          </select>
          {selectedCustomer && (selectedCustomer.balance || 0) > 0 && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Doit déjà {formatPrice(selectedCustomer.balance || 0)}
            </p>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 scrollbar-thin scrollbar-thumb-neutral-800">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <ShoppingCart className="w-10 h-10 mb-2 stroke-[1.5] text-neutral-600" />
              <p className="text-xs">Panier vide</p>
              <p className="text-[11px] text-neutral-600 mt-1">
                Touchez un produit pour l&apos;ajouter à l&apos;encaissement
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
                  {item.serialNumber && (
                    <p className="text-[10px] font-mono text-neutral-400 truncate">N° {item.serialNumber}</p>
                  )}
                  <p className="text-[11px] text-gold-soft">
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
                      disabled={!!item.serialNumber}
                      className="w-5 h-5 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white disabled:opacity-30"
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
            <span>Sous-total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-gold" /> Remise ({currency})
            </span>
            <input
              type="number"
              min="0"
              max={subtotal}
              inputMode="numeric"
              value={discount || ''}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="w-24 text-right bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-gold"
            />
          </div>

          <div className="pt-2 border-t border-neutral-800 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-white">Total à payer</span>
            <span className="text-2xl font-black text-gold-soft tracking-tight">
              {formatPrice(total)}
            </span>
          </div>

          <GlowButton
            disabled={cart.length === 0}
            onClick={handleOpenCheckout}
            glowColor="rgba(212, 160, 23, 0.4)"
            className="w-full h-12 bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold rounded-2xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-gold/20"
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
              <h2 className="text-xl font-bold text-white">Finaliser l&apos;encaissement</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Client : {selectedCustomer?.name || 'client de passage'}
                {isResellerPricing && ' · tarif revendeur'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gold/10 border border-gold/30 text-center">
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                Montant total à percevoir
              </span>
              <p className="text-3xl font-black text-gold-soft mt-1">
                {formatPrice(total)}
              </p>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300">Mode de règlement</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'cash', label: 'Espèces', icon: Banknote },
                    { id: 'mobile', label: 'Wave / MoMo', icon: Smartphone },
                    { id: 'card', label: 'Carte bancaire', icon: CreditCard },
                    { id: 'bank_transfer', label: 'Virement', icon: Barcode },
                    { id: 'credit', label: 'À crédit', icon: Clock },
                  ] as const
                ).map((m) => {
                  const Icon = m.icon;
                  const locked = m.id === 'credit' && !selectedCustomer;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={locked}
                      title={locked ? 'Choisissez le client (ou le revendeur) qui paiera plus tard' : undefined}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all disabled:opacity-40 ${
                        paymentMethod === m.id
                          ? 'bg-gold/15 border-gold text-gold-soft'
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

                {missing > 0 ? (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between text-xs">
                    <span className="text-red-300">Il manque :</span>
                    <span className="text-base font-bold text-red-400">{formatPrice(missing)}</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Monnaie à rendre :</span>
                    <span className="text-base font-bold text-emerald-400">{formatPrice(changeToReturn)}</span>
                  </div>
                )}
                {missing > 0 && (
                  <p className="text-[11px] text-neutral-500">
                    Le client ne paie pas tout maintenant ? Choisissez « À crédit » (client obligatoire) : le reste sera suivi dans sa fiche.
                  </p>
                )}
              </div>
            )}

            {/* À crédit : acompte éventuel, le reste est dû par le client */}
            {paymentMethod === 'credit' && selectedCustomer && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Acompte versé maintenant ({currency}) — facultatif</label>
                  <Input
                    type="number"
                    min={0}
                    max={total}
                    inputMode="numeric"
                    value={deposit || ''}
                    onChange={(e) => setDeposit(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="bg-neutral-900 border-neutral-800 text-white font-bold text-base h-11 rounded-xl"
                  />
                </div>
                {safeDeposit > 0 && (
                  <div className="flex gap-2">
                    {(['cash', 'mobile'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDepositMethod(m)}
                        className={`flex-1 h-9 rounded-xl border text-xs font-semibold ${depositMethod === m ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}
                      >
                        Acompte en {m === 'cash' ? 'espèces' : 'Mobile Money'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-200">Reste à payer par {selectedCustomer.name} :</span>
                    <span className="text-base font-bold text-amber-400">{formatPrice(dueAfter)}</span>
                  </div>
                  {(selectedCustomer.balance || 0) > 0 && (
                    <p className="text-[11px] text-amber-200/80">Sa dette passera à {formatPrice((selectedCustomer.balance || 0) + dueAfter)}.</p>
                  )}
                </div>
              </div>
            )}

            {checkoutError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">{checkoutError}</p>}

            <button
              onClick={handleFinalizeSale}
              disabled={!canValidate}
              className="w-full h-12 bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold rounded-2xl hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-gold/20"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {paymentMethod === 'credit' ? 'Valider la vente à crédit' : 'Valider la vente'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SCAN DU N° DE SÉRIE */}
      {serialPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-4 relative">
            <button
              onClick={() => setSerialPicker(null)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white">{serialPicker.name}</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Scannez le N° de série / IMEI de l&apos;appareil remis au client.</p>
            </div>
            <BarcodeScanner onScan={handleSerialPicked} />
            {serialError && <p className="text-xs text-red-400">{serialError}</p>}
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
                {completedSale.items?.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {it.quantity}× {it.productName}
                      {it.serialNumber && <span className="block text-[10px] text-neutral-500">N° {it.serialNumber}</span>}
                    </span>
                    <span>{formatPrice(it.total)}</span>
                  </div>
                ))}
              </div>

              {!!completedSale.discount && (
                <div className="flex justify-between text-neutral-400">
                  <span>Remise</span>
                  <span>− {formatPrice(completedSale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white pt-1">
                <span>TOTAL</span>
                <span>{formatPrice(completedSale.total)}</span>
              </div>
              {completedSale.paymentMethod === 'credit' ? (
                <>
                  {!!completedSale.depositAmount && (
                    <div className="flex justify-between">
                      <span>Acompte versé</span>
                      <span>{formatPrice(completedSale.depositAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-amber-400">
                    <span>RESTE À PAYER</span>
                    <span>{formatPrice(completedSale.amountDue || 0)}</span>
                  </div>
                </>
              ) : (
                !!completedSale.change && (
                  <div className="flex justify-between">
                    <span>Monnaie rendue</span>
                    <span>{formatPrice(completedSale.change)}</span>
                  </div>
                )
              )}
              <div className="text-[10px] text-neutral-500 text-center pt-2">
                Merci de votre visite et à bientôt !
              </div>
            </div>

            <ReceiptButton saleId={completedSale._id} />
            <Link
              href={`/contract?sale=${completedSale._id}`}
              className="w-full py-2.5 rounded-xl bg-gold/10 border border-gold/40 text-gold-soft text-xs font-bold flex items-center justify-center gap-2"
            >
              <FileSignature className="w-4 h-4" /> Contrat et garantie du client
            </Link>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCompletedSale(null);
                  setIsCheckoutOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gold text-ink text-xs font-bold hover:brightness-110 transition-all"
              >
                Nouvelle vente
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

            <h3 className="text-base font-bold text-white">Ajouter un client</h3>

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
              <label className="text-xs text-neutral-400 block mb-1">Téléphone</label>
              <PhoneInput country={newCustCountry} onCountryChange={setNewCustCountry} value={newCustPhone} onChange={setNewCustPhone} />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isResellerCheck"
                checked={newCustIsReseller}
                onChange={(e) => setNewCustIsReseller(e.target.checked)}
                className="w-4 h-4 accent-gold"
              />
              <label htmlFor="isResellerCheck" className="text-xs text-neutral-300">
                Revendeur (tarif revendeur, peut acheter à crédit)
              </label>
            </div>
            {newCustError && <p className="text-xs text-red-400">{newCustError}</p>}

            <button
              type="submit"
              disabled={createCustomer.isPending}
              className="w-full py-2.5 rounded-xl bg-gold text-ink font-bold text-xs hover:brightness-110 transition-all mt-2 disabled:opacity-50"
            >
              Enregistrer le client
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
