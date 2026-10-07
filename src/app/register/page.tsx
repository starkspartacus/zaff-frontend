'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { Logo } from '@/components/ui/logo';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import { ArrowLeft, Building2, User, Phone, Mail, Lock, Coins, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function RegisterPage() {
  const { registerEstablishment, login } = useAuth();
  const router = useRouter();

  // Boutique fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [currency, setCurrency] = useState('F CFA');
  const [address, setAddress] = useState('');

  // Admin fields
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Auto slugify when name changes
  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const created: { slug?: string } = await registerEstablishment({
        name,
        slug: slug.trim(),
        phone: storePhone,
        email: storeEmail || undefined,
        currency: currency || 'F CFA',
        address: address || undefined,
        adminName,
        adminPhone: adminPhone || storePhone,
        adminPassword,
      });

      setIsSuccess(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#d4a017', '#ffffff', '#e5b83b'],
      });

      // Automatically log the user in after 1.5s
      setTimeout(async () => {
        try {
          // Le backend normalise le slug (accents, espaces) : on utilise celui qu'il a créé
          await login(adminPhone || storePhone, adminPassword, created?.slug || slug.trim());
        } catch {
          router.push('/login');
        }
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ||
        'Une erreur est survenue lors de la création de la boutique. Vérifiez les informations.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden px-4 py-12">
      {/* Background radial gold glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#d4a017]/15 to-transparent rounded-full blur-[140px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-[#d4a017] transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Retour à l'accueil
        </Link>

        <div className="bg-neutral-950/85 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/80 relative">
          <div className="absolute -top-px left-16 right-16 h-px bg-gradient-to-r from-transparent via-[#d4a017]/60 to-transparent" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <Logo size="lg" className="mb-4" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Créer votre boutique</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Activez votre base de données isolée et votre terminal POS en quelques secondes
            </p>
          </div>

          {isSuccess ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-12 text-center flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-full bg-[#d4a017]/20 border border-[#d4a017] flex items-center justify-center text-[#d4a017] mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Boutique initialisée avec succès !</h2>
              <p className="text-neutral-400 text-sm max-w-md">
                Votre espace sécurisé multi-tenant <span className="text-[#d4a017] font-semibold">{name}</span> ({slug}) est prêt. Redirection vers votre cockpit...
              </p>
              <div className="mt-6 w-8 h-8 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : (
            <>
              {/* Error alert */}
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-3 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Section 1: Boutique */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-[#d4a017] font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" /> 1. Informations de l'Établissement
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Nom de la boutique *
                      </label>
                      <Input
                        type="text"
                        placeholder="Ex: Zaff Cocody"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        required
                        className="bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Identifiant unique (Slug) *
                      </label>
                      <Input
                        type="text"
                        placeholder="Ex: zaff-cocody"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        required
                        className="bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Téléphone boutique *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                        <Input
                          type="tel"
                          placeholder="+225 07..."
                          value={storePhone}
                          onChange={(e) => setStorePhone(e.target.value)}
                          required
                          className="pl-9 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Email boutique (Optionnel)
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                        <Input
                          type="email"
                          placeholder="boutique@zaff.com"
                          value={storeEmail}
                          onChange={(e) => setStoreEmail(e.target.value)}
                          className="pl-9 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Devise monétaire
                      </label>
                      <div className="relative">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                        <Input
                          type="text"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="pl-9 bg-neutral-900/80 border-neutral-800 text-white focus-visible:ring-[#d4a017] rounded-xl h-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Adresse physique
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                        <Input
                          type="text"
                          placeholder="Abidjan, Rue des Jardins"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="pl-9 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-900 pt-4">
                  <h3 className="text-xs uppercase tracking-wider text-[#d4a017] font-semibold mb-3 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> 2. Administrateur du Magasin
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Nom administrateur *
                      </label>
                      <Input
                        type="text"
                        placeholder="Ex: Kouamé Marc"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        required
                        className="bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Téléphone connexion *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                        <Input
                          type="tel"
                          placeholder="+225 07..."
                          value={adminPhone}
                          onChange={(e) => setAdminPhone(e.target.value)}
                          className="pl-9 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Mot de passe *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                        <Input
                          type="password"
                          placeholder="Minimum 6 caractères"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          required
                          className="pl-9 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <GlowButton
                    type="submit"
                    disabled={isLoading}
                    glowColor="rgba(212, 160, 23, 0.4)"
                    className="w-full h-12 bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-semibold rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" />
                        Créer mon Établissement et Démarrer
                      </>
                    )}
                  </GlowButton>
                </div>
              </form>

              <div className="mt-6 text-center text-xs text-neutral-400">
                Vous avez déjà un compte ?{' '}
                <Link href="/login" className="text-[#d4a017] hover:underline font-medium">
                  Se connecter
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
