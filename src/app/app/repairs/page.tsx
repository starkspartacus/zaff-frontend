'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  Wrench,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  X,
  Smartphone,
  Tag,
  DollarSign,
  User,
} from 'lucide-react';

export default function RepairsPage() {
  const { establishment } = useAuth();
  const [repairs, setRepairs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal create
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceBrand, setDeviceBrand] = useState('');
  const [serialOrImei, setSerialOrImei] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [laborCost, setLaborCost] = useState<number>(0);
  const [partsCost, setPartsCost] = useState<number>(0);

  // Modal update status
  const [selectedRepair, setSelectedRepair] = useState<any>(null);
  const [updateStatusVal, setUpdateStatusVal] = useState<string>('pending');
  const [updateNotes, setUpdateNotes] = useState('');

  useEffect(() => {
    fetchRepairs();
  }, []);

  const fetchRepairs = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/repairs');
      if (Array.isArray(res)) {
        setRepairs(res);
      }
    } catch (err) {
      console.error('Error fetching repairs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (val: number) => `${(val || 0).toLocaleString('fr-FR')} ${currency}`;

  const handleCreateRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/repairs', {
        customerName,
        customerPhone,
        deviceModel,
        deviceBrand: deviceBrand || undefined,
        serialOrImei: serialOrImei || undefined,
        issueDescription,
        diagnostic: diagnostic || undefined,
        laborCost: Number(laborCost) || 0,
        partsCost: Number(partsCost) || 0,
        totalCost: (Number(laborCost) || 0) + (Number(partsCost) || 0),
      });

      setIsCreateOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setDeviceModel('');
      setDeviceBrand('');
      setSerialOrImei('');
      setIssueDescription('');
      setLaborCost(0);
      setPartsCost(0);
      fetchRepairs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la création du ticket SAV');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair) return;

    try {
      await api.patch(`/repairs/${selectedRepair._id}/status`, {
        status: updateStatusVal,
        diagnostic: updateNotes || undefined,
      });

      setSelectedRepair(null);
      fetchRepairs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    }
  };

  const filtered = repairs.filter((r) => {
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.ticketNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q) ||
      r.deviceModel?.toLowerCase().includes(q) ||
      r.serialOrImei?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Diagnostic / Attente
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <Wrench className="w-3 h-3" /> En cours
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Prêt (Réparé)
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
            <Truck className="w-3 h-3" /> Remis au client
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#d4a017]" />
            Atelier SAV & Réparations
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gestion des tickets de panne, suivi des pièces détachées, devis et délivrance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input
              type="text"
              placeholder="N° ticket, IMEI, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 rounded-xl h-10"
            />
          </div>

          <GlowButton
            onClick={() => setIsCreateOpen(true)}
            glowColor="rgba(212, 160, 23, 0.4)"
            className="px-4 py-2 bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shrink-0 shadow-md shadow-[#d4a017]/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau Ticket SAV
          </GlowButton>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: `Tous (${repairs.length})` },
          { id: 'pending', label: 'En attente' },
          { id: 'in_progress', label: 'En cours' },
          { id: 'completed', label: 'Prêt' },
          { id: 'delivered', label: 'Livré' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === tab.id
                ? 'bg-[#d4a017] text-black'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Repairs Table */}
      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Ticket</th>
                <th className="py-3.5 px-4">Date de Dépôt</th>
                <th className="py-3.5 px-4">Client</th>
                <th className="py-3.5 px-4">Appareil & Panne</th>
                <th className="py-3.5 px-4 text-center">Statut</th>
                <th className="py-3.5 px-4 text-right">Devis / Coût</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <div className="w-6 h-6 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement des dossiers atelier...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    Aucune réparation dans cette vue.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r._id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#f5d77f]">
                      {r.ticketNumber}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400">
                      {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{r.customerName}</div>
                      <div className="text-[10px] text-neutral-400">{r.customerPhone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-[#d4a017]" />
                        {r.deviceBrand ? `${r.deviceBrand} ` : ''}{r.deviceModel}
                      </div>
                      <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                        {r.issueDescription}
                      </div>
                      {r.serialOrImei && (
                        <div className="text-[10px] font-mono text-neutral-500">
                          IMEI: {r.serialOrImei}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex justify-center">{getStatusBadge(r.status)}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#f5d77f]">
                      {formatPrice(r.totalCost || (r.laborCost || 0) + (r.partsCost || 0))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedRepair(r);
                          setUpdateStatusVal(r.status);
                          setUpdateNotes(r.diagnostic || '');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-[#d4a017] text-neutral-300 hover:text-white text-[11px] transition-colors"
                      >
                        Gérer Statut
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE REPAIR TICKET MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleCreateRepair}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-white">Nouveau Dossier Atelier SAV</h2>

            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Nom Client *</label>
                  <Input
                    type="text"
                    placeholder="Ex: Michel Koffi"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Téléphone *</label>
                  <Input
                    type="tel"
                    placeholder="+225 07..."
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Modèle de l'appareil *</label>
                  <Input
                    type="text"
                    placeholder="Ex: iPhone 13 Pro 128G"
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    required
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Marque</label>
                  <Input
                    type="text"
                    placeholder="Ex: Apple, Samsung..."
                    value={deviceBrand}
                    onChange={(e) => setDeviceBrand(e.target.value)}
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">IMEI ou Numéro de Série</label>
                <Input
                  type="text"
                  placeholder="35892109482..."
                  value={serialOrImei}
                  onChange={(e) => setSerialOrImei(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Description de la Panne / Symptômes *</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Écran fissuré après chute, tactile ne répond plus sur la moitié inférieure..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#d4a017]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Coût Pièces ({currency})</label>
                  <Input
                    type="number"
                    value={partsCost || ''}
                    onChange={(e) => setPartsCost(Number(e.target.value) || 0)}
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Main d'uvre ({currency})</label>
                  <Input
                    type="number"
                    value={laborCost || ''}
                    onChange={(e) => setLaborCost(Number(e.target.value) || 0)}
                    className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-neutral-400">Total Devis Estimé :</span>
                <span className="text-base font-bold text-[#f5d77f]">
                  {formatPrice((Number(partsCost) || 0) + (Number(laborCost) || 0))}
                </span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#d4a017] text-black font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-[#d4a017]/20"
              >
                Créer Ticket SAV
              </button>
            </div>
          </form>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {selectedRepair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleUpdateStatus}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setSelectedRepair(null)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-white">
              Ticket {selectedRepair.ticketNumber}
            </h2>
            <p className="text-xs text-neutral-400">
              {selectedRepair.deviceModel}  {selectedRepair.customerName}
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nouveau Statut</label>
                <select
                  value={updateStatusVal}
                  onChange={(e) => setUpdateStatusVal(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a017] h-10"
                >
                  <option value="pending">En attente / Diagnostic</option>
                  <option value="in_progress">En cours de réparation</option>
                  <option value="completed">Prêt / Réparé (Avertir client)</option>
                  <option value="delivered">Délivré / Clôturé</option>
                  <option value="cancelled">Annulé / Refus devis</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Rapport d'intervention / Notes</label>
                <textarea
                  rows={3}
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  placeholder="Notes du technicien, référence de l'écran remplacé..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#d4a017]"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setSelectedRepair(null)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Fermer
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#d4a017] text-black font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-[#d4a017]/20"
              >
                Mettre à Jour
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
