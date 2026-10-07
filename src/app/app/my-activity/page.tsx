'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useMyStats } from '@/lib/queries';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { CalendarCheck, PackagePlus, RefreshCw, ScanLine } from 'lucide-react';

const PERIODS = [
  { id: 'day', label: "Aujourd'hui" },
  { id: 'week', label: '7 jours' },
  { id: 'month', label: 'Ce mois' },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile: 'Mobile Money',
  card: 'Carte',
  bank_transfer: 'Virement',
  credit: 'Crédit',
};

const time = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function MyActivityPage() {
  const { user, establishment } = useAuth();
  const isStorekeeper = user?.role === 'storekeeper';
  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (v?: number) => `${(v || 0).toLocaleString('fr-FR')} ${currency}`;

  const [period, setPeriod] = useState('day');
  // Mis à jour automatiquement après chaque vente / mise en stock (WebSocket)
  const { data, isFetching: isLoading, refetch } = useMyStats(period);
  const load = () => refetch();
  const changePeriod = (id: string) => setPeriod(id);

  const periodLabel = PERIODS.find((p) => p.id === period)?.label.toLowerCase();

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <CalendarCheck className="w-6 h-6 text-[#d4a017]" /> Mon activité
        </h1>
        <button onClick={load} className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900" title="Rafraîchir">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-neutral-900 border border-neutral-800">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => changePeriod(p.id)}
            className={`py-2 rounded-xl text-xs font-semibold transition-all ${
              period === p.id ? 'bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isStorekeeper ? (
        <>
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6 text-center">
            <p className="text-xs uppercase tracking-wider text-neutral-500">Appareils mis en stock {periodLabel}</p>
            <p className="text-5xl font-black text-[#f5d77f] mt-1">
              <NumberTicker value={data?.stocking?.unitsAdded ?? 0} />
            </p>
          </div>
          <Link href="/app/receive" className="w-full h-12 rounded-2xl bg-[#d4a017] text-black font-bold text-sm flex items-center justify-center gap-2">
            <PackagePlus className="w-4 h-4" /> Mettre des appareils en stock
          </Link>
          <List
            title="Derniers appareils enregistrés"
            empty="Aucun appareil enregistré sur la période."
            items={(data?.stocking?.recent || []).map((u) => ({
              key: u._id,
              title: u.productId?.name || 'Produit',
              sub: u.serialNumber,
              right: u.status === 'sold' ? 'Vendu' : u.status === 'defective' ? 'Défectueux' : 'En stock',
              when: time(u.createdAt),
            }))}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-center">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Ventes</p>
              <p className="text-4xl font-black text-white mt-1">
                <NumberTicker value={data?.sales?.count ?? 0} />
              </p>
            </div>
            <div className="rounded-3xl border border-[#d4a017]/30 bg-[#d4a017]/5 p-5 text-center">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Montant encaissé</p>
              <p className="text-xl font-black text-[#f5d77f] mt-2">
                <NumberTicker value={data?.sales?.revenue ?? 0} suffix={currency} />
              </p>
            </div>
          </div>
          <Link href="/app/scan" className="w-full h-12 rounded-2xl bg-[#d4a017] text-black font-bold text-sm flex items-center justify-center gap-2">
            <ScanLine className="w-4 h-4" /> Nouvelle vente
          </Link>
          <List
            title={`Mes ventes (${periodLabel})`}
            empty="Aucune vente sur la période."
            items={(data?.sales?.recent || []).map((s) => ({
              key: s._id,
              title: s.items?.map((i) => i.productName).join(', ') || 'Vente',
              sub: [
                `#${s.invoiceNumber}`,
                PAYMENT_LABELS[s.paymentMethod] || s.paymentMethod,
                s.items?.map((i) => i.serialNumber).filter(Boolean).join(', '),
              ]
                .filter(Boolean)
                .join(' · '),
              right: formatPrice(s.total),
              when: time(s.saleDate),
            }))}
          />
        </>
      )}
    </div>
  );
}

function List({ title, empty, items }: { title: string; empty: string; items: { key: string; title: string; sub: string; right: string; when: string }[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{title}</p>
      {items.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 py-6">{empty}</p>
      ) : (
        items.map((i) => (
          <div key={i.key} className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{i.title}</p>
              <p className="text-[11px] text-neutral-500 font-mono truncate">{i.sub}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-[#f5d77f]">{i.right}</p>
              <p className="text-[10px] text-neutral-500">{i.when}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
