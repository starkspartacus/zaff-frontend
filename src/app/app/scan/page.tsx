'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { BarcodeScanner, type ScanSource } from '@/components/scan/barcode-scanner';
import { PhoneInput } from '@/components/forms/geo-fields';
import { ProductVisual } from '@/components/products/product-visual';
import { scanFeedback } from '@/components/scan/feedback';
import { errorMessage, type CreditNoteInfo, type Customer, type Product, type Sale, type ScanLookup } from '@/lib/types';
import { prepareAutoReceipt, ReceiptButton } from '@/components/print/receipt-button';
import { printReceipt } from '@/components/print/receipt';
import { lookupCreditNote, useCreateSale, useCustomers, useMyStats, useReturnPolicy, useSellUnit } from '@/lib/queries';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  HandCoins,
  Store,
  FileSignature,
  PackageSearch,
  Lock,
  ShieldCheck,
  Ticket,
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
  | { kind: 'sold'; sale: Sale; productName: string; serialNumber?: string; customerName?: string };

const PAYMENTS = [
  { id: 'cash', label: 'Espèces', icon: Banknote },
  { id: 'mobile', label: 'Mobile Money', icon: Smartphone },
  { id: 'card', label: 'Carte', icon: CreditCard },
  { id: 'credit', label: 'À crédit', icon: HandCoins },
] as const;

/** Prix proposé : tarif revendeur pour un revendeur (s'il existe), sinon prix public */
const priceFor = (p: Product | undefined, reseller: boolean) => (reseller && (p?.resellerPrice || 0) > 0 ? p!.resellerPrice! : p?.salePrice || 0);

/** La page lit `?credit=AV-…` (échange) : composant client sous Suspense, recommandé par Next pour useSearchParams */
export default function ScanSellPage() {
  return (
    <Suspense fallback={null}>
      <ScanSell />
    </Suspense>
  );
}

function ScanSell() {
  const { establishment } = useAuth();
  const params = useSearchParams();
  const creditParam = params.get('credit');
  /** `?code=` : appareil choisi dans la vitrine, recherché comme s'il venait d'être scanné */
  const codeParam = params.get('code');
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
  /** Particulier (prix public) ou revendeur enregistré (tarif revendeur, crédit possible) */
  const [saleMode, setSaleMode] = useState<'retail' | 'reseller'>('retail');
  const [resellerId, setResellerId] = useState<string>('');
  const [deposit, setDeposit] = useState(0);
  const { data: resellers = [] } = useCustomers('resellers');
  const defaultWarranty = useReturnPolicy().data?.defective?.defaultWarrantyMonths ?? 12;
  /** L'appareil a-t-il été confirmé physiquement ? scan (caméra / douchette) ou N° retapé (étiquette illisible) */
  const [confirmation, setConfirmation] = useState<'scan' | 'manual' | null>(null);
  const isSelling = sellUnit.isPending || createSale.isPending;

  // Avoir (échange ou bon d'achat) appliqué à la prochaine vente
  const [credit, setCredit] = useState<CreditNoteInfo | null>(null);
  const [creditError, setCreditError] = useState<string | null>(null);
  const applyCredit = (code: string) =>
    lookupCreditNote(code)
      .then((note) => {
        if (!note.usable) throw new Error(note.expired ? `L'avoir ${note.code} a expiré.` : `L'avoir ${note.code} a déjà été utilisé.`);
        setCredit(note);
        setCreditError(null);
      })
      .catch((err) => {
        setCredit(null);
        setCreditError(errorMessage(err));
      });
  useEffect(() => {
    if (creditParam) applyCredit(creditParam);
  }, [creditParam]);

  const resetOptions = (product?: Product) => {
    setPaymentMethod('cash');
    setPrice(priceFor(product, saleMode === 'reseller' && !!resellerId));
    setDeposit(0);
    setEditPrice(false);
    // Appareil suivi : client et garantie proposés d'office (la garantie est liée à la vente)
    setShowCustomer(!!product?.hasSerialNumbers);
    setCustomerName('');
    setCustomerPhone('');
    setWarrantyMonths(defaultWarranty);
  };

  const handleScan = async (code: string, source?: ScanSource) => {
    setStep({ kind: 'loading', code });
    // Lu par la caméra ou la douchette = appareil présent ; saisi à la main ou ouvert depuis la Vitrine = à confirmer
    setConfirmation(source === 'camera' || source === 'scanner' ? 'scan' : null);
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
  useEffect(() => {
    if (!codeParam) return;
    const t = setTimeout(() => handleScan(codeParam), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule recherche à l'ouverture
  }, [codeParam]);

  /** Changer de client : le prix suit (tarif revendeur ↔ prix public), le crédit n'est permis qu'au revendeur */
  const chooseMode = (mode: 'retail' | 'reseller', id = resellerId) => {
    setSaleMode(mode);
    setResellerId(id);
    if (mode === 'retail' && paymentMethod === 'credit') setPaymentMethod('cash');
    if (step.kind === 'found') setPrice(priceFor(step.data.product, mode === 'reseller' && !!id));
  };

  const handleSell = async () => {
    if (step.kind !== 'found') return;
    const { data } = step;
    const reseller = saleMode === 'reseller' && resellerId ? resellers.find((r) => r._id === resellerId) : undefined;
    const customer: { customerId?: string; customerName?: string; customerPhone?: string } = reseller
      ? { customerId: reseller._id }
      : showCustomer && (customerName || customerPhone)
        ? { customerName: customerName || undefined, customerPhone: customerPhone || undefined }
        : {};
    const hasCustomer = !!(customer.customerId || customer.customerName || customer.customerPhone);
    const credit_ = paymentMethod === 'credit' ? { depositAmount: deposit || 0, depositMethod: deposit > 0 ? 'cash' : undefined } : {};
    // Impression automatique du ticket : fenêtre ouverte dès le clic (sinon bloquée par le navigateur)
    const receiptWin = prepareAutoReceipt();
    try {
      let sale: Sale;
      if (data.type === 'unit') {
        const res = await sellUnit.mutateAsync({
          serialNumber: data.unit.serialNumber,
          paymentMethod,
          unitPrice: Number(price) || 0,
          warrantyMonths: hasCustomer ? warrantyMonths : 0,
          creditNoteCode: credit?.code,
          confirmation: confirmation || undefined,
          saleType: reseller ? 'reseller' : 'purchase',
          ...credit_,
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
          saleType: reseller ? 'reseller' : 'purchase',
          creditNoteCode: credit?.code,
          ...credit_,
          ...customer,
        });
      }
      if (receiptWin) printReceipt(sale._id, {}, receiptWin).catch(() => undefined);
      scanFeedback(true);
      setCredit(null); // un avoir ne sert qu'une fois (le reste éventuel reste sur l'avoir)
      setStep({
        kind: 'sold',
        sale,
        productName: data.product.name,
        serialNumber: data.type === 'unit' ? data.unit.serialNumber : undefined,
        customerName: reseller?.name || customer.customerName,
      });
    } catch (err) {
      receiptWin?.close();
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
            <ScanLine className="w-6 h-6 text-gold" /> Vendre
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">Scannez l&apos;appareil à vendre</p>
        </div>
        <Link
          href="/app/my-activity"
          className="text-right px-3 py-2 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-gold transition-colors"
        >
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Mes ventes du jour</p>
          <p className="text-sm font-bold text-gold-soft">
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

      {credit && (
        <BlurFade className="rounded-2xl border border-gold/40 bg-gold/5 px-4 py-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-white min-w-0">
            <Ticket className="w-4 h-4 text-gold shrink-0" />
            <span className="truncate">
              Avoir <strong className="font-mono whitespace-nowrap">{credit.code}</strong> appliqué
            </span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <strong className="text-gold-soft whitespace-nowrap">{formatPrice(credit.balance)}</strong>
            <button onClick={() => setCredit(null)} className="p-1 text-neutral-500 hover:text-white" aria-label="Retirer l'avoir">
              <X className="w-4 h-4" />
            </button>
          </span>
        </BlurFade>
      )}
      {creditError && !credit && <p className="text-xs text-red-400">{creditError}</p>}

      {step.kind === 'idle' && (
        <div className="rounded-3xl border border-dashed border-neutral-800 p-8 text-center text-neutral-400 text-sm space-y-2">
          <PackageSearch className="w-10 h-10 mx-auto text-neutral-600" />
          <p>Scannez le <strong className="text-white">N° de série / IMEI</strong> de l&apos;appareil.</p>
          <p className="text-xs text-neutral-500">Caméra du téléphone, douchette ou saisie au clavier.</p>
        </div>
      )}

      {step.kind === 'loading' && (
        <div className="rounded-3xl border border-neutral-800 p-8 text-center text-neutral-400 text-sm">
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
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
          creditBalance={credit?.balance || 0}
          onApplyCredit={applyCredit}
          confirmation={confirmation}
          onConfirm={setConfirmation}
          saleMode={saleMode}
          resellerId={resellerId}
          resellers={resellers}
          onChooseMode={chooseMode}
          deposit={deposit}
          setDeposit={setDeposit}
        />
        </BlurFade>
      )}

      {step.kind === 'sold' && (
        <BlurFade>
        <ResultCard tone="success">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
          <div>
            <p className="text-2xl font-black text-white">Vendu !</p>
            <p className="text-3xl font-black text-gold-soft mt-1">{formatPrice(step.sale.total)}</p>
          </div>
          <p className="text-sm text-neutral-300">
            {step.productName}
            {step.serialNumber && <span className="block font-mono text-xs text-neutral-500 mt-0.5">{step.serialNumber}</span>}
          </p>
          <p className="text-xs text-neutral-400">
            Facture <span className="font-mono text-white">#{step.sale.invoiceNumber}</span> · stock mis à jour
            {step.sale.creditNoteAmount ? (
              <span className="block mt-1 text-gold-soft">
                Avoir {step.sale.creditNoteCode} : −{formatPrice(step.sale.creditNoteAmount)} · encaissé {formatPrice(step.sale.total - step.sale.creditNoteAmount)}
              </span>
            ) : null}
          </p>
          {step.sale.paymentMethod === 'credit' && (
            <p className="text-sm font-bold text-amber-400">
              {step.customerName ? `${step.customerName} doit ` : 'Reste à payer : '}
              {formatPrice(step.sale.amountDue || 0)}
              {step.sale.depositAmount ? <span className="block text-xs font-normal text-neutral-400">Acompte reçu : {formatPrice(step.sale.depositAmount)}</span> : null}
            </p>
          )}
          <ReceiptButton saleId={step.sale._id} />
          <Link
            href={`/contract?sale=${step.sale._id}`}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-sm flex items-center justify-center gap-2"
          >
            <FileSignature className="w-4 h-4" /> Contrat et garantie du client
          </Link>
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
      className="w-full h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-white font-semibold text-sm hover:border-gold flex items-center justify-center gap-2"
    >
      <ScanLine className="w-4 h-4 text-gold" /> {label}
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
  creditBalance: number;
  onApplyCredit: (code: string) => Promise<void>;
  confirmation: 'scan' | 'manual' | null;
  onConfirm: (c: 'scan' | 'manual') => void;
  saleMode: 'retail' | 'reseller';
  resellerId: string;
  resellers: Customer[];
  onChooseMode: (mode: 'retail' | 'reseller', id?: string) => void;
  deposit: number;
  setDeposit: (v: number) => void;
}) {
  const { establishment, user } = useAuth();
  const [country, setCountry] = useState(establishment?.countryCode || 'CI');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [creditCode, setCreditCode] = useState('');
  const [showCredit, setShowCredit] = useState(false);
  const { data, formatPrice } = props;
  const product = data.product;
  const details = [product.brand, product.model, product.color].filter(Boolean).join(' · ');
  const normCode = (c: string) => c.replace(/\s+/g, '').toUpperCase();
  /** Code attendu pour confirmer : N° de série de l'appareil, ou code-barres de l'accessoire */
  const expected = data.type === 'unit' ? data.unit.serialNumber : product.barcode || null;
  const isReseller = props.saleMode === 'reseller';
  const reseller = isReseller ? props.resellers.find((r) => r._id === props.resellerId) : undefined;
  const needsReseller = isReseller && !reseller;
  const toPay = Math.max(0, props.price - props.creditBalance);
  const depositTooHigh = props.paymentMethod === 'credit' && props.deposit > toPay;
  // Un vendeur ne vend pas à perte (le serveur refuse de toute façon) : prévenu avant d'appuyer
  const belowCost = user?.role === 'seller' && (product.purchasePrice || 0) > 0 && props.price < (product.purchasePrice || 0);
  const locked = !!expected && !props.confirmation;
  const blocked = locked || needsReseller || depositTooHigh || belowCost;
  const confirm = (code: string, source: ScanSource) => {
    if (expected && normCode(code) === normCode(expected)) {
      setConfirmError(null);
      scanFeedback(true);
      props.onConfirm(source === 'keyboard' ? 'manual' : 'scan');
    } else {
      scanFeedback(false);
      setConfirmError(`Ce n'est pas le même article (${normCode(code)}). Scannez l'appareil que le client emporte.`);
    }
  };

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

  if (data.type === 'unit' && !data.sellable && data.consignment) {
    const k = data.consignment;
    return (
      <ResultCard tone="error" onClose={props.onCancel}>
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <p className="text-base font-semibold text-white">Appareil en dépôt chez {k.customerName}</p>
        <p className="text-sm text-neutral-300">
          {product.name}
          <span className="block font-mono text-xs text-neutral-500">{data.unit.serialNumber}</span>
        </p>
        <p className={`text-xs ${k.overdue ? 'text-red-400' : 'text-neutral-400'}`}>
          Bon {k.code} · depuis {k.daysOut} jour(s){k.overdue ? ' · délai dépassé' : ''}
        </p>
        <Link
          href={`/app/consignments?serial=${encodeURIComponent(data.unit.serialNumber)}`}
          className="block w-full h-12 leading-[3rem] rounded-xl bg-gold text-ink font-semibold"
        >
          Enregistrer le retour ou la vente
        </Link>
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
    <div className="relative rounded-3xl border border-gold/40 bg-neutral-950 p-5 sm:p-6 space-y-5 shadow-xl shadow-gold/5">
      <BorderBeam size={120} duration={5} />
      {/* Fiche produit */}
      <div className="flex items-start justify-between gap-3">
        <ProductVisual imageId={product.imageId} category={product.category} brand={product.brand} size="thumb" name={product.name} className="w-20 h-20 shrink-0" />
        <div className="min-w-0 flex-1">
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
            className="w-full h-14 text-center text-2xl font-black rounded-2xl bg-neutral-900 border border-gold text-gold-soft focus:outline-none"
            autoFocus
          />
        ) : (
          <p className="text-4xl font-black text-gold-soft">{formatPrice(props.price)}</p>
        )}
        <button
          onClick={() => props.setEditPrice(!props.editPrice)}
          className="mt-1 text-[11px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
        >
          {props.editPrice ? 'Valider le prix' : 'Modifier le prix'}
        </button>
        {reseller && (
          <p className="text-[11px] text-gold-soft mt-1">
            {(product.resellerPrice || 0) > 0 ? `Tarif revendeur (public : ${formatPrice(product.salePrice)})` : "Pas de tarif revendeur pour ce modèle : prix public"}
          </p>
        )}
        {belowCost && <p className="text-[11px] text-red-400 mt-1">Prix sous le prix d&apos;achat : seul le propriétaire peut vendre à ce prix.</p>}
      </div>

      {/* Client : particulier ou revendeur enregistré */}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de client">
        {(
          [
            ['retail', 'Particulier', UserPlus],
            ['reseller', 'Revendeur', Store],
          ] as const
        ).map(([mode, label, Icon]) => (
          <button
            key={mode}
            role="radio"
            aria-checked={props.saleMode === mode}
            onClick={() => props.onChooseMode(mode)}
            className={`h-11 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 ${
              props.saleMode === mode ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {isReseller && (
        <div className="space-y-1.5">
          <select
            value={props.resellerId}
            onChange={(e) => props.onChooseMode('reseller', e.target.value)}
            aria-label="Revendeur"
            className={`w-full h-11 px-3 rounded-xl bg-neutral-900 border text-sm text-white focus:outline-none focus:border-gold ${needsReseller ? 'border-amber-500/60' : 'border-neutral-800'}`}
          >
            <option value="">Choisissez le revendeur…</option>
            {props.resellers.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
                {r.phone ? ` · ${r.phone}` : ''}
                {(r.balance || 0) > 0 ? ` · doit ${formatPrice(r.balance || 0)}` : ''}
              </option>
            ))}
          </select>
          {props.resellers.length === 0 && (
            <p className="text-[11px] text-neutral-500">
              Aucun revendeur enregistré.{' '}
              <Link href="/app/customers" className="text-gold-soft underline">
                Ajouter un revendeur
              </Link>
            </p>
          )}
          {(reseller?.balance || 0) > 0 && (
            <p className="text-[11px] text-amber-400">{reseller!.name} doit déjà {formatPrice(reseller!.balance || 0)}.</p>
          )}
        </div>
      )}

      {/* Avoir */}
      {props.creditBalance > 0 ? (
        <div className="rounded-2xl bg-gold/5 border border-gold/30 px-4 py-3 space-y-1 text-sm">
          <div className="flex items-center justify-between gap-3 text-neutral-300">
            <span>Avoir déduit</span>
            <span className="whitespace-nowrap">−{formatPrice(Math.min(props.creditBalance, props.price))}</span>
          </div>
          <div className="flex items-center justify-between gap-3 font-black text-white">
            <span>À payer</span>
            <span className="whitespace-nowrap text-base">{formatPrice(Math.max(0, props.price - props.creditBalance))}</span>
          </div>
        </div>
      ) : showCredit ? (
        <div className="flex gap-2">
          <input
            value={creditCode}
            onChange={(e) => setCreditCode(e.target.value.toUpperCase())}
            placeholder="Code de l'avoir (ex. AV-1001)"
            className="flex-1 h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm font-mono text-white focus:outline-none focus:border-gold"
          />
          <button
            onClick={() => creditCode.trim() && props.onApplyCredit(creditCode.trim())}
            className="h-11 px-4 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold"
          >
            Appliquer
          </button>
        </div>
      ) : (
        <button onClick={() => setShowCredit(true)} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5">
          <Ticket className="w-4 h-4 text-gold" /> Le client a un avoir
        </button>
      )}

      {/* Paiement */}
      <div className={`grid gap-2 ${isReseller ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {PAYMENTS.filter((m) => m.id !== 'credit' || isReseller).map((m) => {
          const Icon = m.icon;
          const active = props.paymentMethod === m.id;
          return (
            <button
              key={m.id}
              onClick={() => props.setPaymentMethod(m.id)}
              className={`h-14 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                active ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
              }`}
            >
              <Icon className="w-4 h-4" /> {m.label}
            </button>
          );
        })}
      </div>
      {props.paymentMethod === 'credit' && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
          <label className="text-[11px] text-neutral-300 block">Acompte versé maintenant (espèces, facultatif)</label>
          <input
            type="number"
            min={0}
            value={props.deposit || ''}
            onChange={(e) => props.setDeposit(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold"
          />
          <p className={`text-xs font-bold ${depositTooHigh ? 'text-red-400' : 'text-amber-400'}`}>
            {depositTooHigh ? "L'acompte dépasse le montant de la vente" : `Reste à payer : ${formatPrice(toPay - props.deposit)}`}
          </p>
        </div>
      )}

      {/* Client (optionnel) */}
      {!isReseller && (
      <div className="rounded-2xl border border-neutral-800">
        <button
          onClick={() => props.setShowCustomer(!props.showCustomer)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs text-neutral-300"
        >
          <span className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-gold" /> Client et garantie {data.type === 'unit' ? '(conseillé)' : '(facultatif)'}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${props.showCustomer ? 'rotate-180' : ''}`} />
        </button>
        {props.showCustomer && (
          <div className="px-4 pb-4 space-y-2">
            <input
              value={props.customerName}
              onChange={(e) => props.setCustomerName(e.target.value)}
              placeholder="Nom du client"
              className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold"
            />
            <PhoneInput country={country} onCountryChange={setCountry} value={props.customerPhone} onChange={props.setCustomerPhone} />
            {data.type === 'unit' && (
              <select
                value={props.warrantyMonths}
                onChange={(e) => props.setWarrantyMonths(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold"
              >
                <option value={0}>Sans garantie</option>
                <option value={3}>Garantie 3 mois</option>
                <option value={6}>Garantie 6 mois</option>
                <option value={12}>Garantie 12 mois</option>
                <option value={24}>Garantie 24 mois</option>
              </select>
            )}
            {data.type === 'unit' && (
              <p className="text-[11px] text-neutral-500 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                {props.customerName || props.customerPhone
                  ? `La garantie de ${props.warrantyMonths} mois est créée avec la vente, au nom du client, et imprimée sur son contrat (QR de vérification).`
                  : 'Indiquez le nom ou le téléphone du client pour enregistrer sa garantie avec la vente.'}
              </p>
            )}
          </div>
        )}
      </div>
      )}
      {isReseller && data.type === 'unit' && (
        <select
          value={props.warrantyMonths}
          onChange={(e) => props.setWarrantyMonths(Number(e.target.value))}
          aria-label="Garantie"
          className="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-gold"
        >
          <option value={0}>Sans garantie</option>
          <option value={3}>Garantie 3 mois</option>
          <option value={6}>Garantie 6 mois</option>
          <option value={12}>Garantie 12 mois</option>
          <option value={24}>Garantie 24 mois</option>
        </select>
      )}

      {/* Contrôle de sécurité : l'article vendu doit être physiquement scanné (ou son N° retapé) */}
      {expected && (
        <div className={`rounded-2xl border p-4 space-y-2 ${props.confirmation ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
          {props.confirmation ? (
            <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Article vérifié {props.confirmation === 'scan' ? 'par scan' : 'par saisie du N°'}
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" /> Scannez l&apos;article pour activer « Oui, vendre »
              </p>
              <p className="text-[11px] text-neutral-400">
                Étiquette illisible ? Tapez le {data.type === 'unit' ? 'N° de série / IMEI' : 'code-barres'} inscrit sur l&apos;appareil puis « OK ».
              </p>
              <BarcodeScanner onScan={confirm} placeholder={data.type === 'unit' ? "Scannez ou tapez l'IMEI de l'appareil" : 'Scannez le code-barres'} />
              {confirmError && <p className="text-xs text-red-400">{confirmError}</p>}
            </>
          )}
        </div>
      )}

      {/* Question de confirmation */}
      <div className="space-y-2">
        <p className="text-center text-sm font-semibold text-white">
          {reseller ? `Vendre cet article à ${reseller.name} ?` : 'Voulez-vous vendre cet article ?'}
        </p>
        {needsReseller && <p className="text-center text-[11px] text-amber-400">Choisissez le revendeur pour appliquer son tarif.</p>}
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
            disabled={props.isSelling || blocked}
            className="col-span-2 h-14 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-base hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
          >
            {props.isSelling ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                {blocked ? <Lock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />} Oui, vendre
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
