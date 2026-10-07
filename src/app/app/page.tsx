'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { SpotlightCard } from '@/components/seraui/spotlight-card';
import {
  ShoppingCart,
  Wrench,
  Boxes,
  TrendingUp,
  Receipt,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export default function AppPage() {
  const { user, establishment } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, salesRes] = await Promise.allSettled([
          api.get('/analytics/dashboard?period=day'),
          api.get('/sales'),
        ]);

        if (dashRes.status === 'fulfilled') {
          setStats(dashRes.value);
        }
        if (salesRes.status === 'fulfilled' && Array.isArray(salesRes.value)) {
          setRecentSales(salesRes.value.slice(0, 5));
        }
      } catch (err) {
        console.error('Error fetching dashboard preview:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatPrice = (amount: number) => {
    return `${(amount || 0).toLocaleString('fr-FR')} ${establishment?.currency || 'F CFA'}`;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-neutral-900 via-neutral-900/80 to-black border border-neutral-800 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#d4a017]/20 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4a017]/10 border border-[#d4a017]/30 text-[#d4a017] text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Cockpit Direction & Caisse
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Bienvenue, <span className="text-[#f5d77f]">{user?.name}</span> 👋
            </h1>
            <p className="text-neutral-400 text-sm mt-1 max-w-xl">
              Votre établissement <span className="text-white font-medium">{establishment?.name}</span> est actif.
              Voici l'état en direct de vos opérations, caisses et atelier SAV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/app/sales"
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-[#d4a017]/20 flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Ouvrir Caisse POS
            </Link>
            <Link
              href="/app/repairs"
              className="px-5 py-3 rounded-2xl bg-neutral-900 border border-neutral-700 hover:border-[#d4a017]/60 text-white font-medium text-sm transition-all flex items-center gap-2"
            >
              <Wrench className="w-4 h-4 text-[#d4a017]" />
              Nouveau Dossier SAV
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <SpotlightCard className="p-5 rounded-2xl bg-neutral-950/70 border-neutral-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400">Chiffre d'Affaires du jour</span>
            <div className="w-9 h-9 rounded-xl bg-[#d4a017]/10 border border-[#d4a017]/30 flex items-center justify-center text-[#d4a017]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatPrice(stats?.sales?.revenue || 0)}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-medium">Bénéfice net estimé:</span>{' '}
            {formatPrice(stats?.sales?.profit || 0)}
          </p>
        </SpotlightCard>

        <SpotlightCard className="p-5 rounded-2xl bg-neutral-950/70 border-neutral-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400">Ventes du jour</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {stats?.sales?.count || 0}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            Tickets encaissés aujourd&apos;hui
          </p>
        </SpotlightCard>

        <SpotlightCard className="p-5 rounded-2xl bg-neutral-950/70 border-neutral-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400">Atelier SAV en cours</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {stats?.repairs?.pending || 0}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            Appareils en diagnostic ou réparation
          </p>
        </SpotlightCard>

        <SpotlightCard className="p-5 rounded-2xl bg-neutral-950/70 border-neutral-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400">Alertes Stock Bas</span>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {stats?.inventory?.lowStockCount || 0}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            Articles sous le seuil d'alerte
          </p>
        </SpotlightCard>
      </div>

      {/* Quick Launchpad & Recent Sales Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Launchpad (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Raccourcis Opérationnels</h2>
            <span className="text-xs text-neutral-400">Accès immédiat</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/app/sales"
              className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-[#d4a017]/60 hover:bg-neutral-900 transition-all group flex items-start justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#d4a017]/10 border border-[#d4a017]/30 flex items-center justify-center text-[#d4a017] group-hover:scale-105 transition-transform shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
                    Terminal de Vente POS
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Caisse tactile, scan code-barres, tarif revendeur et encaissement rapide.
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-[#d4a017] transition-colors shrink-0" />
            </Link>

            <Link
              href="/app/catalog"
              className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-[#d4a017]/60 hover:bg-neutral-900 transition-all group flex items-start justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#d4a017]/10 border border-[#d4a017]/30 flex items-center justify-center text-[#d4a017] group-hover:scale-105 transition-transform shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
                    Catalogue High-Tech
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Gérez les smartphones, accessoires, pièces détachées et prix.
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-[#d4a017] transition-colors shrink-0" />
            </Link>

            <Link
              href="/app/repairs"
              className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-[#d4a017]/60 hover:bg-neutral-900 transition-all group flex items-start justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#d4a017]/10 border border-[#d4a017]/30 flex items-center justify-center text-[#d4a017] group-hover:scale-105 transition-transform shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
                    Atelier SAV & Réparations
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Suivi des pannes, pièces utilisées, main-d'œuvre et devis clients.
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-[#d4a017] transition-colors shrink-0" />
            </Link>

            <Link
              href="/app/warranties"
              className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-[#d4a017]/60 hover:bg-neutral-900 transition-all group flex items-start justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#d4a017]/10 border border-[#d4a017]/30 flex items-center justify-center text-[#d4a017] group-hover:scale-105 transition-transform shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
                    Garanties & Traçabilité IMEI
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Recherchez un numéro de série et vérifiez l'éligibilité de garantie.
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-[#d4a017] transition-colors shrink-0" />
            </Link>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Dernières Ventes</h2>
            <Link
              href="/app/invoices"
              className="text-xs text-[#d4a017] hover:underline flex items-center gap-1"
            >
              Voir tout <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 space-y-3">
            {recentSales.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                Aucune vente récente enregistrée.
              </div>
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale._id}
                  className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/60 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {sale.invoiceNumber}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate">
                      {sale.customerId?.name || 'Client Comptant'} • {new Date(sale.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-[#f5d77f]">
                      {formatPrice(sale.total)}
                    </p>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Payé
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
