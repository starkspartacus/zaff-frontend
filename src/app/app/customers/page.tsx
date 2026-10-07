'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Star,
  Edit2,
  Trash2,
  X,
  Building,
} from 'lucide-react';

export default function CustomersPage() {
  const { establishment } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'retail' | 'reseller'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState<any>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isReseller, setIsReseller] = useState(false);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/customers');
      if (Array.isArray(res)) {
        setCustomers(res);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCust(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setIsReseller(false);
    setCompanyName('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: any) => {
    setEditingCust(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setAddress(c.address || '');
    setIsReseller(c.isReseller || false);
    setCompanyName(c.companyName || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        phone,
        email: email || undefined,
        address: address || undefined,
        isReseller,
        companyName: companyName || undefined,
      };

      if (editingCust) {
        await api.put(`/customers/${editingCust._id}`, payload);
      } else {
        await api.post('/customers', payload);
      }

      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’enregistrement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous supprimer ce client ?')) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  const filtered = customers.filter((c) => {
    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'reseller' && c.isReseller) ||
      (filterType === 'retail' && !c.isReseller);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-gold" />
            Clients & Partenaires Revendeurs
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Répertoire commercial, tarification grossiste et historique d'achats
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input
              type="text"
              placeholder="Nom, téléphone, société..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 rounded-xl h-10"
            />
          </div>

          <GlowButton
            onClick={openCreateModal}
            glowColor="rgba(212, 160, 23, 0.4)"
            className="px-4 py-2 bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shrink-0 shadow-md shadow-gold/20"
          >
            <UserPlus className="w-4 h-4" />
            Nouveau Client
          </GlowButton>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: `Tous (${customers.length})` },
          { id: 'retail', label: `Particuliers (${customers.filter((c) => !c.isReseller).length})` },
          { id: 'reseller', label: `Revendeurs B2B (${customers.filter((c) => c.isReseller).length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === tab.id
                ? 'bg-gold text-ink'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Customers Table */}
      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Client / Entreprise</th>
                <th className="py-3.5 px-4">Type de Compte</th>
                <th className="py-3.5 px-4">Téléphone</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Adresse</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement des contacts...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    Aucun client trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c._id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{c.name}</div>
                      {c.companyName && (
                        <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Building className="w-3 h-3 text-gold" /> {c.companyName}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {c.isReseller ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-gold-soft border border-gold/30">
                          <Star className="w-3 h-3 fill-current" /> Revendeur B2B
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
                          Particulier
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-neutral-300">{c.phone}</td>
                    <td className="py-3.5 px-4 text-neutral-400">{c.email || '—'}</td>
                    <td className="py-3.5 px-4 text-neutral-400">{c.address || '—'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c._id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT CUSTOMER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleSubmit}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-white">
              {editingCust ? 'Modifier Client' : 'Nouveau Contact Commercial'}
            </h2>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nom complet *</label>
                <Input
                  type="text"
                  placeholder="Ex: Yacouba Koné"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Téléphone *</label>
                <Input
                  type="tel"
                  placeholder="+225 07..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="client@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nom de l'entreprise (Optionnel)</label>
                <Input
                  type="text"
                  placeholder="Ex: Ivoire High-Tech SARL"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Adresse</label>
                <Input
                  type="text"
                  placeholder="Abidjan, Marcory..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isResellerBox"
                  checked={isReseller}
                  onChange={(e) => setIsReseller(e.target.checked)}
                  className="w-4 h-4 accent-gold"
                />
                <label htmlFor="isResellerBox" className="text-xs text-neutral-300">
                  Attribuer le statut Revendeur (Tarif Préférentiel Grossiste)
                </label>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gold text-ink font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-gold/20"
              >
                Enregistrer Contact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
