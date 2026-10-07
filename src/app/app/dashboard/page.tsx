'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { SpotlightCard } from '@/components/seraui/spotlight-card';
import {
  TrendingUp,
  Boxes,
  DollarSign,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  ShoppingBag,
  RefreshCw,
} from 'lucide-react';

export default function DashboardPage() {
  const { establishment } = useAuth();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get(`/analytics/dashboard?period=${period}`);
      setData(res);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  const formatPrice = (amount: number) => {
    return `${(amount || 0).toLocaleString('fr-FR')} ${establishment?.currency || 'F CFA'}`;
  };

  const revenue = data?.sales?.revenue || 0;
  const profit = data?.sales?.profit || 0;
  const marginPercent = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';
  const averageTicket = data?.sales?.count > 0 ? Math.round(revenue / data.sales.count) : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-gold" />
            Analyses Financières & Performance
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Bilan des ventes, marge bénéficiaire, valeur de stock et top références
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900 border border-neutral-800">
          {[
            { id: 'day', label: "Aujourd'hui" },
            { id: 'week', label: '7 jours' },
            { id: 'month', label: 'Ce mois' },
            { id: 'year', label: 'Année' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                period === item.id
                  ? 'bg-gradient-to-r from-gold to-gold-deep text-ink shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={fetchStats}
            title="Rafraîchir"
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard className="p-5 rounded-2xl bg-neutral-950/70 border-neutral-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-400">Chiffre d'Affaires</span>
            <DollarSign className="w-4 h-4 text-gold" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatPrice(revenue)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span className="text-gold-soft font-medium">{data?.sales?.count || 0}</span> ventes réalisées
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 rounded-2xl bg-neutral-950/70 border-neutral-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-400">Bénéfice Net Réalisé</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {formatPrice(profit)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400">
            Taux de marge brute: <span className="text-emerald-400 font-semibold">{marginPercent}%</span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 rounded-2xl bg-neutral-950/70 border-neutral-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-400">Panier Moyen</span>
            <ShoppingBag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatPrice(averageTicket)}
          </div>
          <div className="mt-2 text-[11px] text-neutral-400">
            Moyenne par encaissement client
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 rounded-2xl bg-neutral-950/70 border-neutral-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-400">Valeur Marchande du Stock</span>
            <Boxes className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatPrice(data?.inventory?.totalStockValue || 0)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span className="text-gold-soft font-semibold">{data?.inventory?.totalUnits || 0}</span> articles en réserve
          </div>
        </SpotlightCard>
      </div>

      {/* Top Products and Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top selling products */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-neutral-950/80 border border-neutral-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              Top Produits les Plus Vendus
            </h2>
            <span className="text-xs text-neutral-400">Par volume d'unités</span>
          </div>

          {!data?.topProducts || data.topProducts.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              Aucune donnée de vente enregistrée pour cette période.
            </div>
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((p: any, index: number) => {
                const maxQuantity = data.topProducts[0]?.quantitySold || 1;
                const percent = Math.round((p.quantitySold / maxQuantity) * 100);

                return (
                  <div
                    key={p.productId || index}
                    className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/60 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-neutral-800 text-neutral-300 font-bold flex items-center justify-center text-[11px]">
                          #{index + 1}
                        </span>
                        <span className="font-semibold text-white">{p.productName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gold-soft mr-2">
                          {formatPrice(p.totalRevenue)}
                        </span>
                        <span className="text-neutral-400">({p.quantitySold} vendus)</span>
                      </div>
                    </div>
                    {/* Visual Bar */}
                    <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-gold to-gold-deep h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workshop SAV Stats */}
        <div className="p-6 rounded-3xl bg-neutral-950/80 border border-neutral-800/80 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-gold" />
              Activité Atelier SAV
            </h2>
            <p className="text-xs text-neutral-400">Statut des dossiers de réparation</p>

            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-300">En cours / Diagnostic</p>
                  <p className="text-xl font-bold text-amber-400 mt-0.5">
                    {data?.repairs?.pending || 0}
                  </p>
                </div>
                <div className="text-xs text-amber-300/80 font-medium">À traiter</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-300">Réparations Livrées</p>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">
                    {data?.repairs?.completed || 0}
                  </p>
                </div>
                <div className="text-xs text-emerald-300/80 font-medium">Clôturées</div>
              </div>

              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-300">Alertes Stock Bas</p>
                  <p className="text-xl font-bold text-red-400 mt-0.5">
                    {data?.inventory?.lowStockCount || 0}
                  </p>
                </div>
                <div className="text-xs text-red-300/80 font-medium">À réapprovisionner</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-900">
            <p className="text-[11px] text-neutral-500 text-center">
              Données synchronisées en temps réel depuis votre base de données magasin isolée.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
