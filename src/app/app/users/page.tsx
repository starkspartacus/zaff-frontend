'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { normalizeRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/roles';
import { CreateUserSchema } from '@/lib/schemas';
import { errorMessage } from '@/lib/types';
import { DEFAULT_COUNTRY, formatInternational, isPhoneValid, toE164 } from '@/lib/geo';
import { PhoneInput } from '@/components/forms/geo-fields';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import {
  UserCheck,
  Search,
  UserPlus,
  Shield,
  Phone,
  Mail,
  Lock,
  X,
  Sparkles,
} from 'lucide-react';

export default function UsersPage() {
  const { establishment, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Par défaut, le pays de la boutique
  const [phoneCountry, setPhoneCountry] = useState<string>(establishment?.countryCode || DEFAULT_COUNTRY);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'seller' | 'storekeeper'>('seller');
  const [password, setPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/users');
      if (Array.isArray(res)) {
        setUsers(res);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const e164 = isPhoneValid(phone, phoneCountry) ? toE164(phone, phoneCountry) : null;
    if (!e164) {
      setFormError("Ce numéro n'est pas valide pour le pays choisi.");
      return;
    }
    const parsed = CreateUserSchema.safeParse({ name, phone: e164, email, role, password });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Vérifiez les informations.');
      return;
    }
    try {
      await api.post('/users', { ...parsed.data, email: parsed.data.email || undefined });

      setIsModalOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-gold" />
            Équipe du Magasin & Permissions
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gérez les vendeurs, caissiers et administrateurs autorisés pour {establishment?.name}
          </p>
        </div>

        <GlowButton
          onClick={() => setIsModalOpen(true)}
          glowColor="rgba(212, 160, 23, 0.4)"
          className="px-4 py-2 bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shadow-md shadow-gold/20"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un Collaborateur
        </GlowButton>
      </div>

      {/* Users Table */}
      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Collaborateur</th>
                <th className="py-3.5 px-4">Rôle & Permissions</th>
                <th className="py-3.5 px-4">Téléphone Connexion</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-500">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement de l'équipe...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-500">
                    Aucun collaborateur enregistré.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gold to-amber-200 text-ink font-bold flex items-center justify-center text-xs">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.role === 'admin' || u.role === 'superadmin'
                            ? 'bg-gold/15 text-gold-soft border border-gold/30'
                            : normalizeRole(u.role) === 'storekeeper'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {ROLE_LABELS[normalizeRole(u.role)]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-neutral-300">{u.phone ? formatInternational(u.phone) : '—'}</td>
                    <td className="py-3.5 px-4 text-neutral-400">{u.email || '—'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Actif
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleCreateUser}
            className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-white">Nouveau Collaborateur</h2>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nom complet *</label>
                <Input
                  type="text"
                  placeholder="Ex: Alice Bamba"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Téléphone de connexion *</label>
                <PhoneInput country={phoneCountry} onCountryChange={setPhoneCountry} value={phone} onChange={setPhone} />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Email (Optionnel)</label>
                <Input
                  type="email"
                  placeholder="alice@zaff.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Rôle et permissions *</label>
                <div className="space-y-2">
                  {(['seller', 'storekeeper', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${
                        role === r
                          ? 'bg-gold/15 border-gold'
                          : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <span className={`block text-xs font-bold ${role === r ? 'text-gold-soft' : 'text-white'}`}>
                        {ROLE_LABELS[r]}
                      </span>
                      <span className="block text-[11px] text-neutral-400 mt-0.5">{ROLE_DESCRIPTIONS[r]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Mot de passe temporaire *</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-neutral-900 border-neutral-800 text-white rounded-xl h-10"
                />
              </div>
            </div>

            {formError && <p className="text-xs text-red-400">{formError}</p>}

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
                Créer l'Accès
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
