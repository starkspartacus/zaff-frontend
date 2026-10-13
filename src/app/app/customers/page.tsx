'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import { PhoneInput } from '@/components/forms/geo-fields';
import { formatInternational, toE164 } from '@/lib/geo';
import { useCustomer, useCustomerPayment, useCustomers } from '@/lib/queries';
import { ReturnModal } from '@/components/sales/return-modal';
import { errorMessage, type Customer, type Sale } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Users, Search, UserPlus, Star, Edit2, Trash2, X, Building, Wallet, ChevronRight, Undo2, FileText, Clock } from 'lucide-react';

type Tab = 'all' | 'retail' | 'reseller' | 'debtors';

const METHODS: Array<{ id: string; label: string }> = [
  { id: 'cash', label: 'Espèces' },
  { id: 'mobile', label: 'Mobile Money' },
  { id: 'card', label: 'Carte' },
  { id: 'bank_transfer', label: 'Virement' },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Payée', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  partial: { label: 'Partiellement payée', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  unpaid: { label: 'À payer', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

export default function CustomersPage() {
  const { establishment, user } = useAuth();
  const isOwner = user?.role === 'admin';
  const queryClient = useQueryClient();
  const { data: customers = [], isLoading } = useCustomers('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [paying, setPaying] = useState<Customer | null>(null);

  // Formulaire client
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(establishment?.countryCode || 'CI');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isReseller, setIsReseller] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currency = establishment?.currency || 'F CFA';
  const fmt = (n: number) => `${Math.round(n || 0).toLocaleString('fr-FR')} ${currency}`;

  const openForm = (c: Customer | null) => {
    setEditingCust(c);
    setName(c?.name || '');
    // Numéro enregistré au format international : pays + numéro national pour la saisie
    const parsed = c?.phone ? parsePhoneNumberFromString(c.phone) : undefined;
    setCountry(parsed?.country || establishment?.countryCode || 'CI');
    setPhone(parsed ? parsed.formatNational() : c?.phone || '');
    setEmail(c?.email || '');
    setAddress(c?.address || '');
    setIsReseller(!!c?.isReseller);
    setCompanyName(c?.companyName || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const e164 = phone.trim() ? toE164(phone, country) : null;
    if (phone.trim() && !e164) return setFormError("Ce numéro n'est pas valide pour ce pays.");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: e164 || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        isReseller,
        companyName: companyName.trim() || undefined,
      };
      if (editingCust) await api.put(`/customers/${editingCust._id}`, payload);
      else await api.post('/customers', payload);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Supprimer ${c.name} ?`)) return;
    try {
      await api.delete(`/customers/${c._id}`);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const debtors = customers.filter((c) => (c.balance || 0) > 0);
  const totalDue = debtors.reduce((n, c) => n + (c.balance || 0), 0);

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        const inTab =
          tab === 'all' || (tab === 'reseller' && c.isReseller) || (tab === 'retail' && !c.isReseller) || (tab === 'debtors' && (c.balance || 0) > 0);
        const q = search.toLowerCase().trim();
        const inSearch = !q || [c.name, c.phone, c.companyName].some((v) => v?.toLowerCase().includes(q));
        return inTab && inSearch;
      }),
    [customers, tab, search],
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-gold" />
            Clients & revendeurs
          </h1>
          <p className="text-xs text-neutral-400 mt-1">Tarif revendeur, ventes à crédit, paiements et historique d&apos;achats</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input
              type="text"
              placeholder="Nom, téléphone, société…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 rounded-xl h-10"
            />
          </div>
          <GlowButton
            onClick={() => openForm(null)}
            glowColor="rgba(212, 160, 23, 0.4)"
            className="px-4 py-2 bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shrink-0 shadow-md shadow-gold/20"
          >
            <UserPlus className="w-4 h-4" />
            Nouveau client
          </GlowButton>
        </div>
      </div>

      {/* Argent à encaisser : ventes à crédit pas encore payées */}
      {totalDue > 0 && (
        <button
          onClick={() => setTab('debtors')}
          className="w-full text-left rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3"
        >
          <Wallet className="w-6 h-6 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-white">{fmt(totalDue)} à encaisser</p>
            <p className="text-[11px] text-amber-200/80">
              {debtors.length} client{debtors.length > 1 ? 's doivent' : ' doit'} encore de l&apos;argent (ventes à crédit)
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-300" />
        </button>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: 'all', label: `Tous (${customers.length})` },
            { id: 'retail', label: `Particuliers (${customers.filter((c) => !c.isReseller).length})` },
            { id: 'reseller', label: `Revendeurs (${customers.filter((c) => c.isReseller).length})` },
            { id: 'debtors', label: `Doivent de l'argent (${debtors.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
              tab === t.id ? 'bg-gold text-ink' : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Client / entreprise</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Téléphone</th>
                <th className="py-3.5 px-4 text-right">Achats</th>
                <th className="py-3.5 px-4 text-right">Reste à payer</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement des clients…
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
                      <button onClick={() => setOpenId(c._id)} className="font-semibold text-white hover:text-gold-soft text-left">
                        {c.name}
                      </button>
                      {c.companyName && (
                        <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Building className="w-3 h-3 text-gold" /> {c.companyName}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {c.isReseller ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-gold-soft border border-gold/30">
                          <Star className="w-3 h-3 fill-current" /> Revendeur
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">Particulier</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-neutral-300 whitespace-nowrap">{c.phone ? formatInternational(c.phone) : '—'}</td>
                    <td className="py-3.5 px-4 text-right text-neutral-300 whitespace-nowrap">{fmt(c.totalPurchases || 0)}</td>
                    <td className={cn('py-3.5 px-4 text-right font-bold whitespace-nowrap', (c.balance || 0) > 0 ? 'text-amber-400' : 'text-neutral-600')}>
                      {(c.balance || 0) > 0 ? fmt(c.balance || 0) : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {(c.balance || 0) > 0 && (
                          <button
                            onClick={() => setPaying(c)}
                            className="h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1"
                            title="Encaisser un paiement"
                          >
                            <Wallet className="w-3.5 h-3.5" /> Encaisser
                          </button>
                        )}
                        <button onClick={() => setOpenId(c._id)} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800" title="Fiche et historique">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button onClick={() => openForm(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800" title="Modifier">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isOwner && (
                          <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openId && <CustomerPanel id={openId} fmt={fmt} isOwner={isOwner} onClose={() => setOpenId(null)} onPay={(c) => setPaying(c)} />}
      {paying && <PaymentModal customer={paying} fmt={fmt} onClose={() => setPaying(null)} />}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative max-h-[92vh] overflow-y-auto">
            <button type="button" onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-bold text-white">{editingCust ? 'Modifier le client' : 'Nouveau client'}</h2>
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nom complet *</label>
                <Input type="text" placeholder="Ex : Yacouba Koné" value={name} onChange={(e) => setName(e.target.value)} required className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Téléphone</label>
                <PhoneInput country={country} onCountryChange={setCountry} value={phone} onChange={setPhone} />
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">E-mail</label>
                <Input type="email" placeholder="client@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Entreprise (facultatif)</label>
                <Input type="text" placeholder="Ex : Ivoire High-Tech SARL" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Adresse</label>
                <Input type="text" placeholder="Abidjan, Marcory…" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10" />
              </div>
              <label className="flex items-start gap-2 pt-2 text-xs text-neutral-300">
                <input type="checkbox" checked={isReseller} onChange={(e) => setIsReseller(e.target.checked)} className="w-4 h-4 accent-gold mt-0.5" />
                <span>Revendeur : tarif revendeur à la caisse, peut acheter à crédit</span>
              </label>
              {formError && <p className="text-xs text-red-400">{formError}</p>}
            </div>
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-gold text-ink font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-gold/20 disabled:opacity-50">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/** Paiement d'un client à crédit : la dette baisse, l'argent entre dans ma caisse */
function PaymentModal({ customer, fmt, onClose }: { customer: Customer; fmt: (n: number) => string; onClose: () => void }) {
  const pay = useCustomerPayment();
  const due = customer.balance || 0;
  const [amount, setAmount] = useState<number>(due);
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const value = Math.round(amount || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (value <= 0) return setError('Indiquez le montant reçu.');
    if (value > due) return setError(`${customer.name} doit ${fmt(due)} : le montant ne peut pas être plus élevé.`);
    try {
      const res = await pay.mutateAsync({ id: customer._id, amount: value, method, notes: notes.trim() || undefined });
      setDone(res.balance);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <form onSubmit={submit} className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-4 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1 text-neutral-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
        {done !== null ? (
          <div className="text-center space-y-3 py-2">
            <Wallet className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-base font-bold text-white">{fmt(value)} encaissés</p>
            <p className="text-xs text-neutral-400">{done > 0 ? `${customer.name} doit encore ${fmt(done)}.` : `${customer.name} ne doit plus rien.`}</p>
            <p className="text-[11px] text-neutral-500">L&apos;argent est compté dans votre caisse (à remettre à la clôture).</p>
            <button type="button" onClick={onClose} className="w-full h-10 rounded-xl bg-gold text-ink font-bold text-xs">
              Terminé
            </button>
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-base font-bold text-white">Encaisser un paiement</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                {customer.name} doit <span className="text-amber-400 font-bold">{fmt(due)}</span>
              </p>
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Montant reçu</label>
              <Input type="number" inputMode="numeric" min={1} max={due} value={amount || ''} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="bg-neutral-900 border-neutral-800 text-white font-bold text-base h-11 rounded-xl" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={cn('h-9 rounded-xl border text-xs font-semibold', method === m.id ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400')}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Input type="text" placeholder="Note (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10" />
            {value > 0 && value <= due && <p className="text-[11px] text-neutral-400">Il restera {fmt(due - value)} à payer. Les ventes les plus anciennes sont soldées d&apos;abord.</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="submit" disabled={pay.isPending} className="w-full h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50">
              Encaisser {value > 0 ? fmt(Math.min(value, due)) : ''}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

/** Fiche client : ventes (statut de paiement, reste), paiements reçus, retour de marchandise (propriétaire) */
function CustomerPanel({ id, fmt, isOwner, onClose, onPay }: { id: string; fmt: (n: number) => string; isOwner: boolean; onClose: () => void; onPay: (c: Customer) => void }) {
  const { data, isLoading } = useCustomer(id);
  const [returning, setReturning] = useState<Sale | null>(null);
  const c = data?.customer;
  const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-neutral-950 border-l border-neutral-800 overflow-y-auto p-5 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{c?.name || '…'}</h2>
            <p className="text-xs text-neutral-400">
              {c?.isReseller ? 'Revendeur' : 'Particulier'}
              {c?.phone ? ` · ${formatInternational(c.phone)}` : ''}
              {c?.companyName ? ` · ${c.companyName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading || !data || !c ? (
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-neutral-800 p-3">
                <p className="text-[11px] text-neutral-500">Achats</p>
                <p className="text-base font-bold text-white">{fmt(c.totalPurchases || 0)}</p>
              </div>
              <div className={cn('rounded-2xl border p-3', (c.balance || 0) > 0 ? 'border-amber-500/40 bg-amber-500/10' : 'border-neutral-800')}>
                <p className="text-[11px] text-neutral-500">Reste à payer</p>
                <p className={cn('text-base font-bold', (c.balance || 0) > 0 ? 'text-amber-400' : 'text-neutral-400')}>{fmt(c.balance || 0)}</p>
              </div>
            </div>
            {(c.balance || 0) > 0 && (
              <button onClick={() => onPay(c)} className="w-full h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2">
                <Wallet className="w-4 h-4" /> Encaisser un paiement
              </button>
            )}

            <section className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Ventes ({data.sales.length})</h3>
              {data.sales.length === 0 && <p className="text-xs text-neutral-500">Aucune vente.</p>}
              {data.sales.map((s) => {
                const st = STATUS[s.paymentStatus || 'paid'] || STATUS.paid;
                const returnable = isOwner && s.returnStatus !== 'returned';
                return (
                  <div key={s._id} className="rounded-2xl border border-neutral-800 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Facture #{s.invoiceNumber} · {fmt(s.total)}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {date(s.saleDate)}
                          {s.saleType === 'reseller' ? ' · tarif revendeur' : ''}
                          {s.sellerName ? ` · ${s.sellerName}` : ''}
                        </p>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap', st.cls)}>{st.label}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-2">
                      {s.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ''}${i.productName}${i.serialNumber ? ` (${i.serialNumber})` : ''}`).join(', ')}
                    </p>
                    {(s.amountDue || 0) > 0 && (
                      <p className="text-[11px] text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Reste {fmt(s.amountDue || 0)}
                      </p>
                    )}
                    {!!s.returnedAmount && <p className="text-[11px] text-neutral-400">Retourné : {fmt(s.returnedAmount)}</p>}
                    <div className="flex gap-2">
                      <Link href={`/contract?sale=${s._id}`} className="h-8 px-3 rounded-lg border border-neutral-700 text-[11px] text-neutral-300 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Contrat
                      </Link>
                      {returnable && (
                        <button onClick={() => setReturning(s)} className="h-8 px-3 rounded-lg border border-neutral-700 text-[11px] text-neutral-300 flex items-center gap-1">
                          <Undo2 className="w-3.5 h-3.5" /> Retour de marchandise
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Paiements reçus ({data.payments.length})</h3>
              {data.payments.length === 0 && <p className="text-xs text-neutral-500">Aucun paiement.</p>}
              {data.payments.map((p) => (
                <div key={p._id} className="flex items-center justify-between text-xs border-b border-neutral-900 py-2">
                  <div>
                    <p className={cn('font-semibold', p.amount < 0 ? 'text-red-400' : 'text-white')}>
                      {p.kind === 'deposit' ? 'Acompte' : p.kind === 'refund' ? 'Remboursement' : 'Paiement'} · {METHODS.find((m) => m.id === p.method)?.label || p.method}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {date(p.createdAt)}
                      {p.collectedByName ? ` · ${p.collectedByName}` : ''}
                      {p.allocations.length ? ` · factures ${p.allocations.map((a) => `#${a.invoiceNumber}`).join(', ')}` : ''}
                    </p>
                  </div>
                  <span className={cn('font-bold whitespace-nowrap', p.amount < 0 ? 'text-red-400' : 'text-emerald-400')}>{fmt(p.amount)}</span>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
      {returning && <ReturnModal sale={returning} fmt={fmt} onClose={() => setReturning(null)} />}
    </div>
  );
}
