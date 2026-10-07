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

// Statuts alignés sur l'enum RepairStatus du backend
const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  received: { label: 'Reçu', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Clock },
  diagnosing: { label: 'Diagnostic', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Search },
  waiting_parts: { label: 'Attente pièces', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: AlertCircle },
  repairing: { label: 'En réparation', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Wrench },
  completed: { label: 'Prêt (Réparé)', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  returned: { label: 'Remis au client', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: Truck },
  cancelled: { label: 'Annulé', color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: X },
};

const ticketLabel = (r: { ticketNumber?: number; _id: string }) => (r.ticketNumber ? `SAV-${r.ticketNumber}` : `#${String(r._id).slice(-6).toUpperCase()}`);

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
  const [updateStatusVal, setUpdateStatusVal] = useState<string>('received');
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
        deviceName: deviceBrand ? `${deviceBrand} ${deviceModel}` : deviceModel,
        serialNumber: serialOrImei || undefined,
        issueDescription,
        diagnosis: diagnostic || undefined,
        laborCost: Number(laborCost) || 0,
        partsCost: Number(partsCost) || 0,
        estimatedCost: (Number(laborCost) || 0) + (Number(partsCost) || 0),
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
      alert(err.message || 'Erreur lors de la création du ticket SAV');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair) return;

    try {
      await api.put(`/repairs/${selectedRepair._id}`, {
        status: updateStatusVal,
        repairNotes: updateNotes || undefined,
      });

      setSelectedRepair(null);
      fetchRepairs();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour du statut');
    }
  };

  const filtered = repairs.filter((r) => {
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      ticketLabel(r).toLowerCase().includes(q) ||
      r.customerId?.name?.toLowerCase().includes(q) ||
      r.customerId?.phone?.includes(q) ||
      r.deviceName?.toLowerCase().includes(q) ||
      r.serialNumber?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const meta = STATUS_META[status];
    if (!meta) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
          {status}
        </span>
      );
    }
    const Icon = meta.icon;
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${meta.color}`}>
        <Icon className="w-3 h-3" /> {meta.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-gold" />
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
            className="px-4 py-2 bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shrink-0 shadow-md shadow-gold/20"
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
          { id: 'received', label: 'Reçus' },
          { id: 'diagnosing', label: 'Diagnostic' },
          { id: 'waiting_parts', label: 'Attente pièces' },
          { id: 'repairing', label: 'En réparation' },
          { id: 'completed', label: 'Prêts' },
          { id: 'returned', label: 'Remis' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === tab.id
                ? 'bg-gold text-ink'
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
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
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
                    <td className="py-3.5 px-4 font-mono font-bold text-gold-soft">
                      {ticketLabel(r)}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400">
                      {new Date(r.receivedDate || r.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{r.customerId?.name || (r.ownership === 'shop' ? 'Boutique' : 'Client')}</div>
                      <div className="text-[10px] text-neutral-400">{r.customerId?.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-gold" />
                        {r.deviceName}
                      </div>
                      <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                        {r.issueDescription}
                      </div>
                      {(r.underWarranty || r.ownership === 'shop') && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.underWarranty && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Sous garantie
                            </span>
                          )}
                          {r.ownership === 'shop' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                              Appareil boutique (repris)
                            </span>
                          )}
                        </div>
                      )}
                      {r.serialNumber && (
                        <div className="text-[10px] font-mono text-neutral-500">
                          IMEI: {r.serialNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex justify-center">{getStatusBadge(r.status)}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-gold-soft">
                      {formatPrice(r.actualCost || r.estimatedCost || (r.laborCost || 0) + (r.partsCost || 0))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedRepair(r);
                          setUpdateStatusVal(r.status);
                          setUpdateNotes(r.repairNotes || '');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-gold text-neutral-300 hover:text-white text-[11px] transition-colors"
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
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-gold"
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
                  <label className="text-xs text-neutral-400 block mb-1">Main d'œuvre ({currency})</label>
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
                <span className="text-base font-bold text-gold-soft">
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
                className="px-5 py-2.5 rounded-xl bg-gold text-ink font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-gold/20"
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
              Ticket {ticketLabel(selectedRepair)}
            </h2>
            <p className="text-xs text-neutral-400">
              {selectedRepair.deviceName} • {selectedRepair.customerId?.name}
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nouveau Statut</label>
                <select
                  value={updateStatusVal}
                  onChange={(e) => setUpdateStatusVal(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold h-10"
                >
                  <option value="received">Reçu à l&apos;atelier</option>
                  <option value="diagnosing">Diagnostic en cours</option>
                  <option value="waiting_parts">En attente de pièces</option>
                  <option value="repairing">En cours de réparation</option>
                  <option value="completed">Prêt / Réparé (Avertir client)</option>
                  <option value="returned">Remis au client / Clôturé</option>
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
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-gold"
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
                className="px-5 py-2.5 rounded-xl bg-gold text-ink font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-gold/20"
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
