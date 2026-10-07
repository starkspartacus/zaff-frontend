'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { adminLogin } from '@/lib/admin-api';
import { useAdminStore } from '@/stores/admin-store';
import { errorMessage } from '@/lib/types';
import { Logo } from '@/components/ui/logo';

/** Connexion de l'administrateur de la plateforme (identifiants définis dans l'environnement du serveur) */
export default function AdminLoginPage() {
  const router = useRouter();
  const setSession = useAdminStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await adminLogin(email.trim(), password);
      setSession(res.accessToken, res.admin.email);
      router.replace('/admin');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-950 p-7 space-y-5 shadow-2xl"
      >
        <div className="text-center space-y-2">
          <Logo size="lg" className="mx-auto" />
          <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Administration ZAFF
          </p>
          <p className="text-xs text-neutral-500">Catalogue global des appareils et de leurs photos</p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-950/40 border border-red-800/50 p-3 text-xs text-red-200 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" /> {error}
          </p>
        )}
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-300">E-mail administrateur</span>
          <span className="relative block">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 pl-10 pr-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-gold"
            />
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-300">Mot de passe</span>
          <span className="relative block">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 pl-10 pr-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-gold"
            />
          </span>
        </label>
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-gold to-gold-deep text-ink font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Se connecter
        </button>
      </motion.form>
    </div>
  );
}
