'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Smartphone,
  Calendar,
} from 'lucide-react';

export default function WarrantiesPage() {
  const { establishment } = useAuth();
  const [warranties, setWarranties] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWarranties();
  }, []);

  const fetchWarranties = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/warranties');
      if (Array.isArray(res)) {
        setWarranties(res);
      }
    } catch (err) {
      console.error('Error fetching warranties:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = warranties.filter((w) => {
    const q = search.toLowerCase();
    return (
      w.serialNumber?.toLowerCase().includes(q) ||
      w.productName?.toLowerCase().includes(q) ||
      w.customerName?.toLowerCase().includes(q)
    );
  });

  const getWarrantyStatus = (endDateStr: string, status: string) => {
    if (status === 'voided') {
      return {
        label: 'Garantie Annulée',
        color: 'bg-red-500/15 text-red-400 border-red-500/30',
        icon: AlertTriangle,
      };
    }
    const end = new Date(endDateStr).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        label: 'Expirée',
        color: 'bg-neutral-800 text-neutral-400 border-neutral-700',
        icon: Clock,
      };
    }

    return {
      label: `Actif (${diffDays} j restants)`,
      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      icon: CheckCircle2,
    };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#d4a017]" />
            Garanties & Traçabilité IMEI / N° Série
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Vérifiez l'authenticité et la couverture de garantie des smartphones et équipements vendus
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input
            type="text"
            placeholder="Rechercher IMEI, N° série, article..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 rounded-xl h-10 font-mono"
          />
        </div>
      </div>

      {/* Warranties Table */}
      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Numéro de Série / IMEI</th>
                <th className="py-3.5 px-4">Article Couvert</th>
                <th className="py-3.5 px-4">Client Bénéficiaire</th>
                <th className="py-3.5 px-4">Date de Début</th>
                <th className="py-3.5 px-4">Échéance</th>
                <th className="py-3.5 px-4 text-center">Statut Couverture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <div className="w-6 h-6 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement du registre des garanties...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    Aucune garantie enregistrée. Les garanties sont générées automatiquement lors de la vente d'articles sérialisés.
                  </td>
                </tr>
              ) : (
                filtered.map((w) => {
                  const stat = getWarrantyStatus(w.endDate, w.status);
                  const Icon = stat.icon;

                  return (
                    <tr key={w._id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#f5d77f]">
                        {w.serialNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {w.productName}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-300">
                        {w.customerName || 'Client Comptant'}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400">
                        {new Date(w.startDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400">
                        {new Date(w.endDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${stat.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          {stat.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
