'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { errorMessage, type Product, type Sale, type ScanLookup } from '@/lib/types';
import { useCreateSale, useMyStats, useSellUnit } from '@/lib/queries';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  PackageSearch,
  ScanLine,
  Smartphone,
  UserPlus,
  X,
} from 'lucide-react';

type Lookup = ScanLookup;

type Step =
  | { kind: 'idle' }
  | { kind: 'loading'; code: string }
  | { kind: 'found'; data: Lookup }
  | { kind: 'error'; message: string }
  | { kind: 'sold'; sale: Sale; productName: string; serialNumber?: string };

const PAYMENTS = [
  { id: 'cash', label: 'Espèces', icon: Banknote },
  { id: 'mobile', label: 'Mobile Money', icon: Smartphone },
  { id: 'card', label: 'Carte', icon: CreditCard },
] as const;

export default function ScanSellPage() {
  const { establishment } = useAuth();
  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (v: number) => `${(v || 0).toLocaleString('fr-FR')} ${currency}`;

  const [step, setStep] = useState<Step>({ kind: 'idle' });
  // Compteur du jour : mis à jour par React Query (après chaque vente et via le WebSocket)
  const today = useMyStats('day').data?.sales;
  const sellUnit = useSellUnit();
  const createSale = useCreateSale();

  // Options de la vente
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [price, setPrice] = useState<number>(0);
  const [editPrice, setEditPrice] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const isSelling = sellUnit.isPending || createSale.isPending;

  const resetOptions = (product?: Product) => {
    setPaymentMethod('cash');
    setPrice(product?.salePrice || 0);
    setEditPrice(false);
    setShowCustomer(false);
    setCustomerName('');
    setCustomerPhone('');
    setWarrantyMonths(12);
  };

  const handleScan = async (code: string) => {
    setStep({ kind: 'loading', code });
    try {
      const data = (await api.get(`/units/lookup/${encodeURIComponent(code)}`)) as unknown as Lookup;
      resetOptions(data.product);
      const canSell =
        (data.type === 'unit' && data.sellable) ||
        (data.type === 'product' && !data.product.hasSerialNumbers && data.availableUnits > 0);
      scanFeedback(canSell);
      setStep({ kind: 'found', data });
    } catch (err) {
      scanFeedback(false);
      setStep({ kind: 'error', message: errorMessage(err) });
    }
  };

  const handleSell = async () => {
    if (step.kind !== 'found') return;
    const { data } = step;
    const customer = showCustomer && (customerName || customerPhone)
      ? { customerName: customerName || undefined, customerPhone: customerPhone || undefined }
      : {};
    try {
      let sale: Sale;
      if (data.type === 'unit') {
        const res = await sellUnit.mutateAsync({
          serialNumber: data.unit.serialNumber,
          paymentMethod,
          unitPrice: Number(price) || 0,
          warrantyMonths: customer.customerName || customer.customerPhone ? warrantyMonths : 0,
          ...customer,
        });
        sale = res.sale;
      } else {
        // Article sans N° de série (accessoire) : vente d'une unité
        const p = data.product;
        sale = await createSale.mutateAsync({
          items: [{ productId: p._id, productName: p.name, quantity: 1, unitPrice: Number(price) || 0, total: Number(price) || 0 }],
          subtotal: Number(price) || 0,
          discount: 0,
          total: Number(price) || 0,
          paymentMethod,
          saleType: 'purchase',
          ...customer,
        });
      }
      scanFeedback(true);
      setStep({
        kind: 'sold',
        sale,
        productName: data.product.name,
        serialNumber: data.type === 'unit' ? data.unit.serialNumber : undefined,
      });
    } catch (err) {
      scanFeedback(false);
      setStep({ kind: 'error', message: errorMessage(err) });
    }
  };

  const busy = step.kind === 'found' || step.kind === 'sold' || step.kind === 'loading';

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* En-tête + compteur du jour */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-[#d4a017]" /> Vendre
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">Scannez l&apos;appareil à vendre</p>
        </div>
        <Link
          href="/app/my-activity"
          className="text-right px-3 py-2 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-[#d4a017] transition-colors"
        >
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Mes ventes du jour</p>
          <p className="text-sm font-bold text-[#f5d77f]">
            {today ? (
              <>
                {today.count} · <NumberTicker value={today.revenue} suffix={currency} />
              </>
            ) : (
              '—'
            )}
          </p>
        </Link>
      </div>

      <BarcodeScanner onScan={handleScan} paused={busy} autoStartCamera={false} />

      {step.kind === 'idle' && (
        <div className="rounded-3xl border border-dashed border-neutral-800 p-8 text-center text-neutral-400 text-sm space-y-2">
          <PackageSearch className="w-10 h-10 mx-auto text-neutral-600" />
          <p>Scannez le <strong className="text-white">N° de série / IMEI</strong> de l&apos;appareil.</p>
          <p className="text-xs text-neutral-500">Caméra du téléphone, douchette ou saisie au clavier.</p>
        </div>
      )}

      {step.kind === 'loading' && (
        <div className="rounded-3xl border border-neutral-800 p-8 text-center text-neutral-400 text-sm">
          <div className="w-6 h-6 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Recherche de <span className="font-mono text-white">{step.code}</span>…
        </div>
      )}

      {step.kind === 'error' && (
        <BlurFade key={`err-${step.message}`}>
        <ResultCard tone="error" onClose={() => setStep({ kind: 'idle' })}>
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-base font-semibold text-white">{step.message}</p>
          <ScanAgainButton onClick={() => setStep({ kind: 'idle' })} />
        </ResultCard>
        </BlurFade>
      )}

      {step.kind === 'found' && (
        <BlurFade>
        <FoundCard
          data={step.data}
          formatPrice={formatPrice}
          onCancel={() => setStep({ kind: 'idle' })}
          onSell={handleSell}
          isSelling={isSelling}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          price={price}
          setPrice={setPrice}
          editPrice={editPrice}
          setEditPrice={setEditPrice}
          showCustomer={showCustomer}
          setShowCustomer={setShowCustomer}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          warrantyMonths={warrantyMonths}
          setWarrantyMonths={setWarrantyMonths}
        />
        </BlurFade>
      )}

      {step.kind === 'sold' && (
        <BlurFade>
        <ResultCard tone="success">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
          <div>
            <p className="text-2xl font-black text-white">Vendu !</p>
            <p className="text-3xl font-black text-[#f5d77f] mt-1">{formatPrice(step.sale.total)}</p>
          </div>
          <p className="text-sm text-neutral-300">
            {step.productName}
            {step.serialNumber && <span className="block font-mono text-xs text-neutral-500 mt-0.5">{step.serialNumber}</span>}
          </p>
          <p className="text-xs text-neutral-400">
            Facture <span className="font-mono text-white">#{step.sale.invoiceNumber}</span> · stock mis à jour
          </p>
          <ScanAgainButton onClick={() => setStep({ kind: 'idle' })} label="Scanner l'article suivant" />
        </ResultCard>
        </BlurFade>
      )}
    </div>
  );
}

function ResultCard({ tone, children, onClose }: { tone: 'success' | 'error'; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      className={`relative rounded-3xl border p-6 text-center space-y-4 ${
        tone === 'success' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'
      }`}
    >
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 p-1 text-neutral-500 hover:text-white" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
      )}
      {children}
    </div>
  );
}

function ScanAgainButton({ onClick, label = 'Scanner à nouveau' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      autoFocus
      className="w-full h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-white font-semibold text-sm hover:border-[#d4a017] flex items-center justify-center gap-2"
    >
      <ScanLine className="w-4 h-4 text-[#d4a017]" /> {label}
    </button>
  );
}

function FoundCard(props: {
  data: Lookup;
  formatPrice: (v: number) => string;
  onCancel: () => void;
  onSell: () => void;
  isSelling: boolean;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  price: number;
  setPrice: (v: number) => void;
  editPrice: boolean;
  setEditPrice: (v: boolean) => void;
  showCustomer: boolean;
  setShowCustomer: (v: boolean) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  warrantyMonths: number;
  setWarrantyMonths: (v: number) => void;
}) {
  const { data, formatPrice } = props;
  const product = data.product;
  const details = [product.brand, product.model, product.color].filter(Boolean).join(' · ');

  // Code-barres d'un modèle suivi par N° de série : il faut l'appareil précis
  if (data.type === 'product' && product.hasSerialNumbers) {
    return (
      <ResultCard tone="error" onClose={props.onCancel}>
        <ScanLine className="w-10 h-10 text-amber-400 mx-auto" />
        <p className="text-base font-semibold text-white">{product.name}</p>
        <p className="text-sm text-neutral-300">
          C&apos;est le code-barres du <strong>modèle</strong>. Scannez le <strong>N° de série / IMEI</strong> de
          l&apos;appareil pour le vendre.
        </p>
        <p className="text-xs text-neutral-500">{data.availableUnits} appareil(s) de ce modèle en stock</p>
        <ScanAgainButton onClick={props.onCancel} />
      </ResultCard>
    );
  }

  if (data.type === 'unit' && !data.sellable) {
    const u = data.unit;
    return (
      <ResultCard tone="error" onClose={props.onCancel}>
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="text-base font-semibold text-white">
          {u.status === 'sold' ? 'Cet appareil est déjà vendu' : 'Appareil mis de côté (défectueux)'}
        </p>
        <p className="text-sm text-neutral-300">
          {product.name}
          <span className="block font-mono text-xs text-neutral-500">{u.serialNumber}</span>
        </p>
        {u.status === 'sold' && (
          <p className="text-xs text-neutral-400">
            Facture #{u.invoiceNumber} · vendu par {u.soldByName || '—'}
            {u.soldAt && ` le ${new Date(u.soldAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`}
          </p>
        )}
        <ScanAgainButton onClick={props.onCancel} />
      </ResultCard>
    );
  }

  if (data.type === 'product' && data.availableUnits <= 0) {
    return (
      <ResultCard tone="error" onClose={props.onCancel}>
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="text-base font-semibold text-white">{product.name} : rupture de stock</p>
        <ScanAgainButton onClick={props.onCancel} />
      </ResultCard>
    );
  }

  return (
    <div className="relative rounded-3xl border border-[#d4a017]/40 bg-neutral-950 p-5 sm:p-6 space-y-5 shadow-xl shadow-[#d4a017]/5">
      <BorderBeam size={120} duration={5} />
      {/* Fiche produit */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-white leading-tight">{product.name}</p>
          {details && <p className="text-sm text-neutral-400 mt-0.5">{details}</p>}
          {data.type === 'unit' && (
            <p className="mt-2 inline-block px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-xs text-neutral-300">
              N° {data.unit.serialNumber}
            </p>
          )}
        </div>
        <button onClick={props.onCancel} className="p-1 text-neutral-500 hover:text-white shrink-0" aria-label="Annuler">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Prix */}
      <div className="text-center">
        {props.editPrice ? (
          <input
            type="number"
            min={0}
            value={props.price || ''}
            onChange={(e) => props.setPrice(Number(e.target.value) || 0)}
            className="w-full h-14 text-center text-2xl font-black rounded-2xl bg-neutral-900 border border-[#d4a017] text-[#f5d77f] focus:outline-none"
            autoFocus
          />
        ) : (
          <p className="text-4xl font-black text-[#f5d77f]">{formatPrice(props.price)}</p>
        )}
        <button
          onClick={() => props.setEditPrice(!props.editPrice)}
          className="mt-1 text-[11px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
        >
          {props.editPrice ? 'Valider le prix' : 'Modifier le prix'}
        </button>
      </div>

      {/* Paiement */}
      <div className="grid grid-cols-3 gap-2">
        {PAYMENTS.map((m) => {
          const Icon = m.icon;
          const active = props.paymentMethod === m.id;
          return (
            <button
              key={m.id}
              onClick={() => props.setPaymentMethod(m.id)}
              className={`h-14 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                active ? 'bg-[#d4a017]/15 border-[#d4a017] text-[#f5d77f]' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
              }`}
            >
              <Icon className="w-4 h-4" /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Client (optionnel) */}
      <div className="rounded-2xl border border-neutral-800">
        <button
          onClick={() => props.setShowCustomer(!props.showCustomer)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs text-neutral-300"
        >
          <span className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#d4a017]" /> Client et garantie (facultatif)
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${props.showCustomer ? 'rotate-180' : ''}`} />
        </button>
        {props.showCustomer && (
          <div className="px-4 pb-4 space-y-2">
            <input
              value={props.customerName}
              onChange={(e) => props.setCustomerName(e.target.value)}
              placeholder="Nom du client"
              className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-[#d4a017]"
            />
            <input
              type="tel"
              value={props.customerPhone}
              onChange={(e) => props.setCustomerPhone(e.target.value)}
              placeholder="Téléphone"
              className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-[#d4a017]"
            />
            {data.type === 'unit' && (
              <select
                value={props.warrantyMonths}
                onChange={(e) => props.setWarrantyMonths(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-[#d4a017]"
              >
                <option value={0}>Sans garantie</option>
                <option value={3}>Garantie 3 mois</option>
                <option value={6}>Garantie 6 mois</option>
                <option value={12}>Garantie 12 mois</option>
                <option value={24}>Garantie 24 mois</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Question de confirmation */}
      <div className="space-y-2">
        <p className="text-center text-sm font-semibold text-white">Voulez-vous vendre cet article ?</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={props.onCancel}
            disabled={props.isSelling}
            className="h-14 rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-300 font-bold text-sm hover:text-white"
          >
            Non
          </button>
          <button
            onClick={props.onSell}
            disabled={props.isSelling}
            className="col-span-2 h-14 rounded-2xl bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-extrabold text-base hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#d4a017]/20"
          >
            {props.isSelling ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" /> Oui, vendre
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
