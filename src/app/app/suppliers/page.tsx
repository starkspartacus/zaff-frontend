'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Ban, Building2, Check, ClipboardList, HandCoins, Lightbulb, MessageCircle, Minus, PackageCheck, Pencil, Plus, Printer, Search, Truck, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/forms/geo-fields';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { BlurFade } from '@/components/magicui/blur-fade';
import { formatInternational, toE164 } from '@/lib/geo';
import {
  useCreatePurchaseOrder, usePaySupplier, useProducts, usePurchaseOrderAction, usePurchaseOrders, usePurchaseSummary, useReceivePurchaseOrder,
  useReorderSuggestions, useSaveSupplier, useSuppliers,
} from '@/lib/queries';
import { errorMessage, type Product, type PurchaseOrder, type ReceiveResult, type ReorderSuggestion, type Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';

const money = (n: number, currency: string) => `${Math.round(n || 0).toLocaleString('fr-FR')} ${currency}`;
const dateFr = (d: string | Date) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const waLink = (phone: string | null | undefined, text: string) => `https://wa.me/${(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
const productLabel = (p: Product) => [p.name, p.model].filter(Boolean).join(' ');
const inputCls = 'h-11 bg-neutral-900 border-neutral-800 text-white rounded-xl';

const STATUS: Record<PurchaseOrder['status'], { label: string; cls: string }> = {
  pending: { label: 'Commandée', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/40' },
  partial: { label: 'Reçue en partie', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  received: { label: 'Reçue', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  cancelled: { label: 'Annulée', cls: 'bg-neutral-800 text-neutral-400 border-neutral-700' },
};
const METHODS = [
  { id: 'cash', label: 'Espèces' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'bank_transfer', label: 'Virement' },
];

/** Bon de commande envoyé au fournisseur (WhatsApp / impression) — sans les prix si on ne veut pas les montrer */
function orderText(o: PurchaseOrder, shop: string, currency: string) {
  return [
    `*Bon de commande ${o.code}* — ${shop}`,
    `Fournisseur : ${o.supplierName}`,
    `Date : ${dateFr(o.orderDate)}${o.expectedAt ? ` · livraison souhaitée le ${dateFr(o.expectedAt)}` : ''}`,
    '',
    ...o.items.map((i) => `• ${i.quantity} × ${i.productName} — ${money(i.unitPrice, currency)} (${money(i.total, currency)})`),
    '',
    `*Total : ${money(o.totalAmount, currency)}*`,
    ...(o.notes ? ['', `Note : ${o.notes}`] : []),
    '',
    'Merci de confirmer la disponibilité et la date de livraison.',
  ].join('\n');
}

function printOrder(o: PurchaseOrder, shop: string, currency: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const w = window.open('', '_blank', 'width=760,height=900');
  if (!w) return;
  const rows = o.items
    .map((i) => `<tr><td>${esc(i.productName)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${money(i.unitPrice, currency)}</td><td style="text-align:right">${money(i.total, currency)}</td></tr>`)
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${o.code}</title>
<style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border-bottom:1px solid #ddd;padding:8px;font-size:14px}th{text-align:left;background:#f5f5f5}.t{text-align:right;font-size:18px;font-weight:700;margin-top:16px}</style>
</head><body><h1>Bon de commande ${o.code}</h1><div>${esc(shop)}</div>
<p><b>Fournisseur :</b> ${esc(o.supplierName)}<br><b>Date :</b> ${dateFr(o.orderDate)}${o.expectedAt ? `<br><b>Livraison souhaitée :</b> ${dateFr(o.expectedAt)}` : ''}</p>
<table><thead><tr><th>Article</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix unitaire</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="t">Total : ${money(o.totalAmount, currency)}</div>${o.notes ? `<p>Note : ${esc(o.notes)}</p>` : ''}
<p style="margin-top:60px">Signature et cachet :</p></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {subtitle && <p className="text-[11px] text-neutral-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: 'red' | 'gold' }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className={cn('text-xl font-black', tone === 'red' ? 'text-red-400' : tone === 'gold' ? 'text-gold-soft' : 'text-white')}>{value}</p>
    </div>
  );
}

type Draft = { supplierId?: string; lines: Array<{ productId: string; quantity: number; unitPrice: number }> };

export default function SuppliersPage() {
  const { user, establishment } = useAuth();
  const isOwner = user?.role === 'admin';
  const currency = establishment?.currency || 'F CFA';
  const shop = establishment?.name || 'Notre boutique';

  const [tab, setTab] = useState<'orders' | 'suppliers' | 'reorder'>('orders');
  const [filter, setFilter] = useState<'open' | 'unpaid' | 'closed'>('open');
  const { data: orders = [], isLoading } = usePurchaseOrders(filter);
  const { data: summary } = usePurchaseSummary();
  const { data: suppliers = [] } = useSuppliers();
  const { data: suggestions = [] } = useReorderSuggestions();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [paying, setPaying] = useState<PurchaseOrder | null>(null);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);

  /** « Commander » depuis les suggestions : un bon par dernier fournisseur */
  const orderSuggestions = (list: ReorderSuggestion[]) =>
    setDraft({
      supplierId: list[0]?.lastSupplierId || undefined,
      lines: list.map((s) => ({ productId: s.productId, quantity: s.suggestedQty, unitPrice: s.lastUnitPrice })),
    });

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-gold" /> Fournisseurs & commandes
          </h1>
          <p className="text-sm text-neutral-400">Commandez, réceptionnez en scannant, suivez ce que vous devez.</p>
        </div>
        <button onClick={() => setDraft({ lines: [] })} className="h-11 px-4 rounded-2xl bg-gold text-ink text-sm font-bold flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Commander
        </button>
      </div>

      <div className={cn('grid gap-2', isOwner ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
        <Tile label="Commandes en cours" value={summary?.openOrders ?? 0} />
        <Tile label="En retard" value={summary?.lateOrders ?? 0} tone={summary?.lateOrders ? 'red' : undefined} />
        <Tile label="Articles à recevoir" value={summary?.toReceive ?? 0} />
        {isOwner && <Tile label="À payer aux fournisseurs" value={money(summary?.amountDue ?? 0, currency)} tone="gold" />}
      </div>

      <div className="flex gap-1.5 p-1 rounded-2xl bg-neutral-950 border border-neutral-800">
        {([
          ['orders', 'Commandes', ClipboardList],
          ['reorder', `À recommander${suggestions.length ? ` (${suggestions.length})` : ''}`, Lightbulb],
          ['suppliers', `Fournisseurs (${suppliers.length})`, Building2],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn('flex-1 h-10 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5', tab === id ? 'bg-gold text-ink' : 'text-neutral-400')}
          >
            <Icon className="w-4 h-4 hidden sm:block" /> {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {([
              ['open', 'En cours'],
              ['unpaid', 'À payer'],
              ['closed', 'Terminées'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn('h-9 px-3 rounded-full border text-xs font-semibold', filter === id ? 'border-gold bg-gold/10 text-gold-soft' : 'border-neutral-800 text-neutral-400')}
              >
                {label}
              </button>
            ))}
          </div>
          {isLoading ? (
            <p className="text-center text-sm text-neutral-500 py-8">Chargement…</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <ClipboardList className="w-10 h-10 text-neutral-700 mx-auto" />
              <p className="text-sm text-neutral-500">Aucune commande ici.</p>
            </div>
          ) : (
            orders.map((o) => (
              <OrderCard
                key={o._id}
                o={o}
                currency={currency}
                shop={shop}
                isOwner={isOwner}
                supplierPhone={suppliers.find((s) => s._id === String(o.supplierId))?.phone}
                onReceive={() => setReceiving(o)}
                onPay={() => setPaying(o)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'reorder' && <ReorderPanel suggestions={suggestions} currency={currency} onOrder={orderSuggestions} />}

      {tab === 'suppliers' && (
        <div className="space-y-2">
          <button onClick={() => setEditing('new')} className="w-full h-11 rounded-xl border border-dashed border-gold/50 text-gold-soft text-sm font-semibold flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau fournisseur
          </button>
          {suppliers.map((s) => (
            <div key={s._id} className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                <p className="text-[11px] text-neutral-500 truncate">
                  {[s.contactPerson, s.phone ? formatInternational(s.phone) : null, `${s.ordersCount} commande(s)`].filter(Boolean).join(' · ')}
                </p>
                {isOwner && s.amountDue > 0 && <p className="text-[11px] font-semibold text-amber-400">Vous lui devez {money(s.amountDue, currency)}</p>}
              </div>
              {s.phone && (
                <a href={waLink(s.phone, `Bonjour ${s.contactPerson || s.name},`)} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-emerald-600/15 text-emerald-400" aria-label="WhatsApp">
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
              <button onClick={() => setDraft({ supplierId: s._id, lines: [] })} className="p-2 rounded-xl bg-gold/15 text-gold" aria-label="Commander">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(s)} className="p-2 rounded-xl bg-neutral-900 text-neutral-300" aria-label="Modifier">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {draft && <NewOrderModal draft={draft} suppliers={suppliers} currency={currency} shop={shop} onNewSupplier={() => setEditing('new')} onClose={() => setDraft(null)} />}
      {receiving && <ReceiveModal order={receiving} onClose={() => setReceiving(null)} />}
      {paying && <PayModal order={paying} currency={currency} onClose={() => setPaying(null)} />}
      {editing && <SupplierModal supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OrderCard({
  o, currency, shop, isOwner, supplierPhone, onReceive, onPay,
}: { o: PurchaseOrder; currency: string; shop: string; isOwner: boolean; supplierPhone?: string | null; onReceive: () => void; onPay: () => void }) {
  const action = usePurchaseOrderAction();
  const [error, setError] = useState<string | null>(null);
  const ordered = o.items.reduce((a, i) => a + i.quantity, 0);
  const received = o.items.reduce((a, i) => a + Math.min(i.receivedQty, i.quantity), 0);
  const open = o.status === 'pending' || o.status === 'partial';
  const st = STATUS[o.status];

  const run = async (kind: 'close' | 'cancel') => {
    const msg = kind === 'cancel' ? 'Annuler cette commande ?' : 'Solder la commande ? Les articles non livrés ne seront plus attendus et la dette sera ramenée à ce qui a été reçu.';
    if (!window.confirm(msg)) return;
    setError(null);
    try {
      await action.mutateAsync({ id: o._id, action: kind });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <BlurFade className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">
            {o.code} · <span className="font-semibold">{o.supplierName}</span>
          </p>
          <p className="text-[11px] text-neutral-500">
            Commandée le {dateFr(o.orderDate)}
            {o.createdByName ? ` par ${o.createdByName}` : ''}
          </p>
          {o.expectedAt && open && (
            <p className={cn('text-[11px] flex items-center gap-1', o.late ? 'text-red-400 font-semibold' : 'text-neutral-400')}>
              {o.late && <AlertTriangle className="w-3 h-3" />} Livraison prévue le {dateFr(o.expectedAt)}
              {o.late ? ' — en retard' : ''}
            </p>
          )}
        </div>
        <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0', st.cls)}>{st.label}</span>
      </div>

      <div className="space-y-1">
        {o.items.map((i) => (
          <div key={i.productId} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-neutral-300 truncate">
              {i.productName}
              {i.hasSerialNumbers && <span className="text-neutral-500"> · N° de série</span>}
            </span>
            <span className={cn('shrink-0 font-mono', i.receivedQty >= i.quantity ? 'text-emerald-400' : 'text-neutral-400')}>
              {i.receivedQty}/{i.quantity}
            </span>
          </div>
        ))}
        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden mt-2">
          <div className="h-full bg-gold" style={{ width: `${ordered ? (received / ordered) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400">
          Total <strong className="text-white">{money(o.totalAmount, currency)}</strong>
        </span>
        {isOwner && o.status !== 'cancelled' && (
          <span className={o.amountDue > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
            {o.amountDue > 0 ? `Reste à payer ${money(o.amountDue, currency)}` : 'Payée'}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {open && (
          <button onClick={onReceive} className="h-10 px-4 rounded-xl bg-gold text-ink text-xs font-bold flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4" /> Réceptionner
          </button>
        )}
        {isOwner && o.amountDue > 0 && o.status !== 'cancelled' && (
          <button onClick={onPay} className="h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5">
            <HandCoins className="w-4 h-4" /> Payer
          </button>
        )}
        <a
          href={waLink(supplierPhone, orderText(o, shop, currency))}
          target="_blank"
          rel="noreferrer"
          className="h-10 px-3 rounded-xl bg-emerald-600/15 text-emerald-400 text-xs font-semibold flex items-center gap-1.5"
        >
          <MessageCircle className="w-4 h-4" /> Envoyer
        </a>
        <button onClick={() => printOrder(o, shop, currency)} className="h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> Bon
        </button>
        {o.status === 'partial' && (
          <button onClick={() => run('close')} className="h-10 px-3 rounded-xl text-neutral-400 text-xs font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Solder
          </button>
        )}
        {o.status === 'pending' && o.paidAmount === 0 && (
          <button onClick={() => run('cancel')} className="h-10 px-3 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-1.5">
            <Ban className="w-4 h-4" /> Annuler
          </button>
        )}
      </div>
    </BlurFade>
  );
}

function ReorderPanel({ suggestions, currency, onOrder }: { suggestions: ReorderSuggestion[]; currency: string; onOrder: (s: ReorderSuggestion[]) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, ReorderSuggestion[]>();
    for (const s of suggestions) {
      const k = s.lastSupplierName || 'Sans fournisseur habituel';
      m.set(k, [...(m.get(k) || []), s]);
    }
    return [...m.entries()];
  }, [suggestions]);

  if (!suggestions.length) {
    return (
      <div className="text-center py-10 space-y-2">
        <Lightbulb className="w-10 h-10 text-neutral-700 mx-auto" />
        <p className="text-sm text-neutral-400">Rien à recommander : tous les articles sont au-dessus de leur seuil d&apos;alerte.</p>
        <p className="text-[11px] text-neutral-500">Le seuil se règle dans la fiche produit (« Alerte stock bas »).</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-400">Articles au niveau d&apos;alerte ou en dessous, regroupés par dernier fournisseur. Les quantités déjà commandées sont déduites.</p>
      {groups.map(([name, list]) => (
        <div key={name} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">{name}</p>
            <button onClick={() => onOrder(list)} className="h-9 px-3 rounded-xl bg-gold text-ink text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Commander tout
            </button>
          </div>
          {list.map((s) => (
            <div key={s.productId} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0">
                <span className="block text-neutral-200 truncate">{s.productName}</span>
                <span className="block text-[11px] text-neutral-500">
                  Stock {s.stockQuantity} / alerte {s.minStockAlert}
                  {s.onOrder ? ` · ${s.onOrder} déjà commandé(s)` : ''}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block font-semibold text-gold-soft">+{s.suggestedQty}</span>
                <span className="block text-[11px] text-neutral-500">{money(s.lastUnitPrice, currency)}</span>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function NewOrderModal({
  draft, suppliers, currency, shop, onNewSupplier, onClose,
}: { draft: Draft; suppliers: Supplier[]; currency: string; shop: string; onNewSupplier: () => void; onClose: () => void }) {
  const { data: products = [] } = useProducts();
  const create = useCreatePurchaseOrder();
  const [supplierId, setSupplierId] = useState(draft.supplierId || '');
  const [lines, setLines] = useState(draft.lines);
  const [query, setQuery] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PurchaseOrder | null>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => !lines.some((l) => l.productId === p._id) && `${productLabel(p)} ${p.sku || ''} ${p.brand || ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [query, products, lines]);
  const total = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const setLine = (id: string, patch: Partial<Draft['lines'][number]>) => setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  const submit = async () => {
    setError(null);
    if (!supplierId) return setError('Choisissez le fournisseur.');
    if (!lines.length) return setError('Ajoutez au moins un article.');
    try {
      const o = await create.mutateAsync({
        supplierId,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
        expectedAt: expectedAt || undefined,
        notes: notes.trim() || undefined,
      });
      setCreated(o);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (created) {
    const phone = suppliers.find((s) => s._id === supplierId)?.phone;
    return (
      <Sheet title="Commande enregistrée" onClose={onClose}>
        <div className="text-center space-y-2">
          <Check className="w-12 h-12 text-emerald-400 mx-auto" />
          <p className="text-xl font-black text-white">{created.code}</p>
          <p className="text-sm text-neutral-400">
            {created.supplierName} · {money(created.totalAmount, currency)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={waLink(phone, orderText(created, shop, currency))} target="_blank" rel="noreferrer" className="h-12 rounded-2xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" /> Envoyer au fournisseur
          </a>
          <button onClick={() => printOrder(created, shop, currency)} className="h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> Imprimer le bon
          </button>
        </div>
        <button onClick={onClose} className="w-full h-11 rounded-2xl text-neutral-400 text-sm">
          Fermer
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Nouvelle commande" subtitle="Le prix d'achat du catalogue est proposé ; modifiez-le si le fournisseur a changé ses prix." onClose={onClose}>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Fournisseur *</label>
        <div className="flex gap-2">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={cn(inputCls, 'flex-1 px-3 border')}>
            <option value="">Choisir…</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
          <button onClick={onNewSupplier} className="h-11 px-3 rounded-xl border border-dashed border-gold/50 text-gold-soft text-xs font-semibold">
            + Nouveau
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-neutral-400 block">Articles</label>
        {lines.map((l) => {
          const p = byId.get(l.productId);
          return (
            <div key={l.productId} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-white">
                  {p ? productLabel(p) : 'Article'}
                  {p?.hasSerialNumbers && <span className="block text-[11px] text-neutral-500">À scanner à la réception (N° de série)</span>}
                </p>
                <button onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} className="text-neutral-500" aria-label="Retirer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-neutral-700">
                  <button onClick={() => setLine(l.productId, { quantity: Math.max(1, l.quantity - 1) })} className="w-9 h-9 flex items-center justify-center text-neutral-300" aria-label="Moins">
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    inputMode="numeric"
                    value={l.quantity}
                    onChange={(e) => setLine(l.productId, { quantity: Math.max(1, parseInt(e.target.value.replace(/\D/g, '') || '1', 10)) })}
                    className="w-12 h-9 bg-transparent text-center text-white text-sm"
                    aria-label="Quantité"
                  />
                  <button onClick={() => setLine(l.productId, { quantity: l.quantity + 1 })} className="w-9 h-9 flex items-center justify-center text-neutral-300" aria-label="Plus">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-neutral-500 text-xs">×</span>
                <input
                  inputMode="numeric"
                  value={l.unitPrice ? String(l.unitPrice) : ''}
                  onChange={(e) => setLine(l.productId, { unitPrice: parseInt(e.target.value.replace(/\D/g, '') || '0', 10) })}
                  placeholder="Prix d'achat"
                  className="flex-1 min-w-0 h-9 rounded-xl border border-neutral-700 bg-transparent px-3 text-right text-white text-sm"
                  aria-label="Prix d'achat unitaire"
                />
              </div>
              <p className="text-right text-[11px] text-neutral-400">{money(l.quantity * l.unitPrice, currency)}</p>
            </div>
          );
        })}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3.5" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ajouter un article du catalogue…" className={cn(inputCls, 'pl-9')} />
        </div>
        {matches.map((p) => (
          <button
            key={p._id}
            onClick={() => {
              setLines((ls) => [...ls, { productId: p._id, quantity: 1, unitPrice: p.purchasePrice || 0 }]);
              setQuery('');
            }}
            className="w-full text-left rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white flex items-center justify-between"
          >
            <span className="truncate">{productLabel(p)}</span>
            <span className="text-[11px] text-neutral-500 shrink-0">stock {p.stockQuantity ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Livraison prévue le</label>
          <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Note</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Facultatif" className={inputCls} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3">
        <span className="text-sm text-neutral-400">Total de la commande</span>
        <span className="text-lg font-black text-gold-soft">{money(total, currency)}</span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={submit} disabled={create.isPending} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold disabled:opacity-60">
        {create.isPending ? 'Enregistrement…' : 'Enregistrer la commande'}
      </button>
    </Sheet>
  );
}

function ReceiveModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const receive = useReceivePurchaseOrder();
  const lines = order.items.filter((i) => i.receivedQty < i.quantity);
  const serialLines = lines.filter((i) => i.hasSerialNumbers);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(lines.filter((i) => !i.hasSerialNumbers).map((i) => [i.productId, i.quantity - i.receivedQty])));
  const [serials, setSerials] = useState<Record<string, string[]>>({});
  const [target, setTarget] = useState(serialLines[0]?.productId || '');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiveResult | null>(null);

  const onScan = (raw: string) => {
    const code = raw.toUpperCase().replace(/\s+/g, '');
    if (!code || !target) return;
    const all = Object.values(serials).flat();
    if (all.includes(code)) {
      scanFeedback(false);
      setError(`${code} est déjà dans la liste.`);
      return;
    }
    const line = serialLines.find((l) => l.productId === target)!;
    const mine = serials[target] || [];
    if (mine.length >= line.quantity - line.receivedQty) {
      scanFeedback(false);
      setError(`Les ${line.quantity - line.receivedQty} « ${line.productName} » attendus sont déjà scannés.`);
      return;
    }
    scanFeedback(true);
    setError(null);
    const next = { ...serials, [target]: [...mine, code] };
    setSerials(next);
    // Ligne complète → on passe à la suivante
    if (mine.length + 1 >= line.quantity - line.receivedQty) {
      const nextLine = serialLines.find((l) => l.productId !== target && (next[l.productId] || []).length < l.quantity - l.receivedQty);
      if (nextLine) setTarget(nextLine.productId);
    }
  };

  const count = Object.values(qty).reduce((a, n) => a + n, 0) + Object.values(serials).reduce((a, s) => a + s.length, 0);

  const submit = async () => {
    setError(null);
    const items = [
      ...Object.entries(qty).filter(([, n]) => n > 0).map(([productId, quantity]) => ({ productId, quantity })),
      ...Object.entries(serials).filter(([, s]) => s.length).map(([productId, serialNumbers]) => ({ productId, serialNumbers })),
    ];
    if (!items.length) return setError('Indiquez ce que vous avez reçu.');
    try {
      setResult(await receive.mutateAsync({ id: order._id, items }));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (result) {
    const rejected = result.results.flatMap((r) => r.rejected.map((x) => ({ ...x, productName: r.productName })));
    return (
      <Sheet title="Réception enregistrée" subtitle={`${order.code} · ${order.supplierName}`} onClose={onClose}>
        <div className="text-center space-y-1">
          <PackageCheck className="w-12 h-12 text-emerald-400 mx-auto" />
          <p className="text-xl font-black text-white">{result.received} article(s) en stock</p>
          <p className="text-xs text-neutral-400">
            {result.order.status === 'received' ? 'Commande entièrement reçue.' : `Il reste ${result.order.remaining} article(s) à recevoir.`}
          </p>
        </div>
        {rejected.length > 0 && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-1">
            <p className="text-xs font-semibold text-red-400">{rejected.length} appareil(s) refusé(s)</p>
            {rejected.map((r) => (
              <p key={r.serialNumber} className="text-[11px] text-neutral-300">
                <span className="font-mono">{r.serialNumber}</span> — {r.reason}
              </p>
            ))}
          </div>
        )}
        <button onClick={onClose} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold">
          Terminé
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Réceptionner la livraison" subtitle={`${order.code} · ${order.supplierName}`} onClose={onClose}>
      {lines
        .filter((i) => !i.hasSerialNumbers)
        .map((i) => {
          const left = i.quantity - i.receivedQty;
          const n = qty[i.productId] ?? 0;
          return (
            <div key={i.productId} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{i.productName}</p>
                <p className="text-[11px] text-neutral-500">Attendu : {left}</p>
              </div>
              <div className="flex items-center rounded-xl border border-neutral-700 shrink-0">
                <button onClick={() => setQty({ ...qty, [i.productId]: Math.max(0, n - 1) })} className="w-9 h-9 flex items-center justify-center text-neutral-300" aria-label="Moins">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-white text-sm font-semibold">{n}</span>
                <button onClick={() => setQty({ ...qty, [i.productId]: n + 1 })} className="w-9 h-9 flex items-center justify-center text-neutral-300" aria-label="Plus">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

      {serialLines.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-400">Scannez le N° de série / IMEI de chaque appareil reçu (pas le code-barres de la boîte).</p>
          <div className="flex flex-wrap gap-2">
            {serialLines.map((l) => {
              const got = (serials[l.productId] || []).length;
              const left = l.quantity - l.receivedQty;
              return (
                <button
                  key={l.productId}
                  onClick={() => setTarget(l.productId)}
                  className={cn('px-3 py-2 rounded-xl border text-left text-xs', target === l.productId ? 'border-gold bg-gold/10 text-white' : 'border-neutral-800 text-neutral-400')}
                >
                  <span className="block font-semibold">{l.productName}</span>
                  <span className={got >= left ? 'text-emerald-400' : ''}>
                    {got}/{left} scanné(s)
                  </span>
                </button>
              );
            })}
          </div>
          <BarcodeScanner onScan={onScan} placeholder="Scannez ou tapez le N° de série / IMEI" />
          <div className="flex flex-wrap gap-1.5">
            {(serials[target] || []).map((sn) => (
              <span key={sn} className="inline-flex items-center gap-1 rounded-full bg-neutral-900 border border-neutral-700 px-2.5 py-1 text-[11px] font-mono text-white">
                {sn}
                <button onClick={() => setSerials({ ...serials, [target]: (serials[target] || []).filter((x) => x !== sn) })} aria-label={`Retirer ${sn}`}>
                  <X className="w-3 h-3 text-neutral-400" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={submit} disabled={receive.isPending || !count} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold disabled:opacity-50">
        {receive.isPending ? 'Enregistrement…' : `Mettre en stock ${count} article(s)`}
      </button>
    </Sheet>
  );
}

function PayModal({ order, currency, onClose }: { order: PurchaseOrder; currency: string; onClose: () => void }) {
  const pay = usePaySupplier();
  const [amount, setAmount] = useState(String(Math.round(order.amountDue)));
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState<string | null>(null);
  const value = parseInt(amount.replace(/\D/g, '') || '0', 10);

  const submit = async () => {
    setError(null);
    if (value <= 0) return setError('Indiquez le montant payé.');
    if (value > order.amountDue) return setError(`C'est plus que le reste à payer (${money(order.amountDue, currency)}).`);
    try {
      await pay.mutateAsync({ id: order._id, amount: value, method });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Sheet title="Payer le fournisseur" subtitle={`${order.code} · ${order.supplierName} · reste ${money(order.amountDue, currency)}`} onClose={onClose}>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Montant payé</label>
        <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(inputCls, 'text-lg font-bold')} />
      </div>
      <div className="flex gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={cn('flex-1 h-11 rounded-xl border text-xs font-semibold', method === m.id ? 'border-gold bg-gold/10 text-gold-soft' : 'border-neutral-800 text-neutral-400')}
          >
            {m.label}
          </button>
        ))}
      </div>
      {order.payments.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500">Déjà payé</p>
          {order.payments.map((p, i) => (
            <p key={i} className="text-[11px] text-neutral-400">
              {dateFr(p.at)} · {money(p.amount, currency)} · {METHODS.find((m) => m.id === p.method)?.label || p.method}
              {p.byName ? ` · ${p.byName}` : ''}
            </p>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={submit} disabled={pay.isPending} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold disabled:opacity-60">
        {pay.isPending ? 'Enregistrement…' : `Enregistrer le paiement de ${money(value, currency)}`}
      </button>
    </Sheet>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { establishment } = useAuth();
  const save = useSaveSupplier();
  const [name, setName] = useState(supplier?.name || '');
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson || '');
  const [country, setCountry] = useState(establishment?.countryCode || 'CI');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [address, setAddress] = useState(supplier?.address || '');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError('Indiquez le nom du fournisseur.');
    const e164 = phone.trim() ? toE164(phone, country) : '';
    if (phone.trim() && !e164) return setError("Le numéro de téléphone n'est pas valide.");
    try {
      await save.mutateAsync({
        id: supplier?._id,
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: e164 || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Sheet title={supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Nom *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Grossiste Tech Adjamé" className={inputCls} autoFocus />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Contact</label>
          <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Ex : M. Yao" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Téléphone (envoi des commandes sur WhatsApp)</label>
          <PhoneInput country={country} onCountryChange={setCountry} value={phone} onChange={setPhone} />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">E-mail</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Facultatif" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Adresse</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Facultatif" className={inputCls} />
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={submit} disabled={save.isPending} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold disabled:opacity-60">
        {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </Sheet>
  );
}
