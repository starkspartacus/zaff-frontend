'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { LoginSchema } from '@/lib/schemas';
import { isPhoneValid, lastCountry, rememberCountry, DEFAULT_COUNTRY } from '@/lib/geo';
import { PhoneInput, FieldLabel } from '@/components/forms/geo-fields';
import { Logo } from '@/components/ui/logo';
import { Input } from '@/components/ui/input';
import { GlowButton } from '@/components/seraui/glow-button';
import { ArrowLeft, Lock, Mail, Smartphone, AlertCircle, KeyRound, Eye, EyeOff, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'phone' | 'email';

const MODES: { id: Mode; label: string; icon: typeof Smartphone }[] = [
  { id: 'phone', label: 'Téléphone', icon: Smartphone },
  { id: 'email', label: 'E-mail', icon: Mail },
];

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('phone');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Même compte dans plusieurs boutiques : l'utilisateur choisit laquelle ouvrir
  const [shops, setShops] = useState<{ slug: string; name: string }[]>([]);

  // Pays utilisé la dernière fois sur cet appareil (lu après le rendu serveur)
  useEffect(() => setCountry(lastCountry()), []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setShops([]);
  };

  const submit = async (slug?: string) => {
    setError(null);
    const parsed = LoginSchema.safeParse(
      mode === 'phone' ? { mode, country, identifier: phone, password } : { mode, identifier: email, password }
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Vérifiez vos informations.');
      return;
    }
    if (parsed.data.mode === 'phone' && !isPhoneValid(parsed.data.identifier, parsed.data.country)) {
      setError("Ce numéro n'est pas valide pour le pays choisi. Vérifiez le pays et le nombre de chiffres.");
      return;
    }
    try {
      if (parsed.data.mode === 'phone') {
        rememberCountry(parsed.data.country);
        await login(parsed.data.identifier, parsed.data.password, slug, parsed.data.country);
      } else {
        await login(parsed.data.identifier, parsed.data.password, slug);
      }
    } catch (err) {
      const choices =
        err instanceof ApiError ? (err.details?.establishments as { slug: string; name: string }[] | undefined) : undefined;
      if (choices?.length) {
        setShops(choices);
        return;
      }
      setError(err instanceof Error ? err.message : 'Identifiants incorrects.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShops([]);
    submit();
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden px-4 py-12">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#d4a017]/15 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-gradient-to-tl from-[#e5b83b]/10 to-transparent rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-[#d4a017] transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Retour à l&apos;accueil
        </Link>

        <div className="bg-neutral-950/80 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative">
          <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#d4a017]/60 to-transparent" />

          <div className="flex flex-col items-center text-center mb-6">
            <Logo size="lg" className="mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Connexion</h1>
            <p className="text-sm text-neutral-400 mt-1">Avec votre numéro de téléphone ou votre e-mail</p>
          </div>

          {/* Téléphone | E-mail */}
          <div role="tablist" className="relative grid grid-cols-2 p-1 mb-6 rounded-2xl bg-neutral-900 border border-neutral-800">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => switchMode(id)}
                className={cn(
                  'relative z-10 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-colors',
                  mode === id ? 'text-black' : 'text-neutral-400 hover:text-white'
                )}
              >
                {mode === id && (
                  <motion.span
                    layoutId="login-mode"
                    className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#f5d77f]"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-3 text-red-200 text-sm"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {shops.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 rounded-2xl bg-[#d4a017]/5 border border-[#d4a017]/30 space-y-2"
            >
              <p className="text-sm text-neutral-300">Votre compte existe dans plusieurs boutiques. Laquelle ouvrir ?</p>
              {shops.map((shop) => (
                <button
                  key={shop.slug}
                  type="button"
                  disabled={isLoading}
                  onClick={() => submit(shop.slug)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-[#d4a017] text-left transition-colors"
                >
                  <Store className="w-4 h-4 text-[#d4a017]" />
                  <span className="text-sm font-semibold text-white">{shop.name}</span>
                </button>
              ))}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === 'phone' ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'phone' ? 16 : -16 }}
                transition={{ duration: 0.18 }}
              >
                {mode === 'phone' ? (
                  <div>
                    <FieldLabel htmlFor="login-phone">Pays et numéro de téléphone</FieldLabel>
                    <PhoneInput
                      id="login-phone"
                      country={country}
                      onCountryChange={(c) => {
                        setCountry(c);
                        setError(null);
                      }}
                      value={phone}
                      onChange={(v) => {
                        setPhone(v);
                        setError(null);
                      }}
                    />
                    <p className="mt-1.5 text-xs text-neutral-500">Choisissez d&apos;abord le pays : l&apos;indicatif s&apos;ajoute tout seul.</p>
                  </div>
                ) : (
                  <div>
                    <FieldLabel htmlFor="login-email">Adresse e-mail</FieldLabel>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <Input
                        id="login-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="vous@exemple.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError(null);
                        }}
                        className="pl-10 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-12 text-base"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div>
              <FieldLabel htmlFor="login-password">Mot de passe</FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  className="pl-10 pr-11 bg-neutral-900/80 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-[#d4a017] rounded-xl h-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                    <KeyRound className="w-4 h-4" />
                    Se connecter
                  </>
                )}
              </GlowButton>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-neutral-900 text-center text-sm text-neutral-400">
            Pas encore de boutique ?{' '}
            <Link href="/register" className="text-[#d4a017] hover:underline font-semibold">
              Créer ma boutique gratuitement
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
