'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { LoginSchema } from '@/lib/schemas';
import { Logo } from '@/components/ui/logo';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import { ArrowLeft, Lock, Smartphone, Building2, AlertCircle, KeyRound, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Même compte dans plusieurs boutiques : l'utilisateur choisit laquelle ouvrir
  const [shops, setShops] = useState<{ slug: string; name: string }[]>([]);

  const submit = async (slug?: string) => {
    setError(null);
    const parsed = LoginSchema.safeParse({ identifier, password, tenantSlug: slug ?? tenantSlug });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Vérifiez vos informations.');
      return;
    }
    try {
      await login(parsed.data.identifier, parsed.data.password, parsed.data.tenantSlug || undefined);
    } catch (err) {
      const choices = err instanceof ApiError ? (err.details?.establishments as { slug: string; name: string }[] | undefined) : undefined;
      if (choices?.length) {
        setShops(choices);
        return;
      }
      setError(err instanceof Error ? err.message : 'Identifiants incorrects ou établissement introuvable.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShops([]);
    submit();
  };

  const handleDemoFill = () => {
    setIdentifier('+2250700000001');
    setPassword('Admin123!');
    setTenantSlug('zaff-plateau');
    setError(null);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden px-4 py-12">
      {/* Background radial gold glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#d4a017]/15 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-gradient-to-tl from-[#e5b83b]/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back to website */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-[#d4a017] transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Retour à l'accueil
        </Link>

        {/* Card */}
        <div className="bg-neutral-950/80 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-8 shadow-2xl shadow-black/80 relative">
          <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#d4a017]/60 to-transparent" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <Logo size="lg" className="mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Connexion à votre espace</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Accédez au terminal de caisse et à la gestion de votre boutique
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-3 text-red-200 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Choix de la boutique */}
          {shops.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-2xl bg-[#d4a017]/5 border border-[#d4a017]/30 space-y-2"
            >
              <p className="text-xs text-neutral-300">Votre compte existe dans plusieurs boutiques. Laquelle ouvrir ?</p>
              {shops.map((shop) => (
                <button
                  key={shop.slug}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setTenantSlug(shop.slug);
                    submit(shop.slug);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-[#d4a017] text-left transition-colors"
                >
                  <span className="text-sm font-semibold text-white">{shop.name}</span>
                  <span className="text-[11px] font-mono text-neutral-500">{shop.slug}</span>
                </button>
              ))}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Identifiant (Téléphone ou Email)
              </label>
              <div className="relative">
                <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  type="text"
                  placeholder="+225 07 00 00 00 01 ou contact@..."
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-11"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-11"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-300">
                  Slug Boutique <span className="text-neutral-500 font-normal">(Optionnel)</span>
                </label>
                <span className="text-[10px] text-neutral-500">Ex: zaff-plateau</span>
              </div>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  type="text"
                  placeholder="Identifiant de votre boutique"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  className="pl-10 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-11"
                />
              </div>
            </div>

            <div className="pt-2">
              <GlowButton
                type="submit"
                disabled={isLoading}
                glowColor="rgba(212, 160, 23, 0.4)"
                className="w-full h-11 bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-semibold rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Se connecter à la boutique
                  </>
                )}
              </GlowButton>
            </div>
          </form>

          {/* Quick fill button */}
          <div className="mt-5 pt-5 border-t border-neutral-900">
            <button
              type="button"
              onClick={handleDemoFill}
              className="w-full py-2 px-3 rounded-lg border border-dashed border-[#d4a017]/30 hover:border-[#d4a017]/60 text-xs text-[#d4a017] hover:bg-[#d4a017]/5 transition-all flex items-center justify-center gap-2 group"
            >
              <Sparkles className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" />
              <span>Remplir les accès démo (Boutique Zaff)</span>
            </button>
          </div>

          {/* Link to register */}
          <div className="mt-6 text-center text-xs text-neutral-400">
            Vous n'avez pas encore d'établissement ?{' '}
            <Link
              href="/register"
              className="text-[#d4a017] hover:underline font-medium"
            >
              Créer votre boutique
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
