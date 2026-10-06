'use client';

import React from 'react';
import Link from 'next/link';
import { GlowButton } from '@/components/seraui/glow-button';
import { ShimmerButton } from '@/components/seraui/shimmer-button';
import { SpotlightCard } from '@/components/seraui/spotlight-card';
import { NumberTicker } from '@/components/seraui/number-ticker';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShoppingCart,
  Wrench,
  ShieldCheck,
  Store,
  TrendingUp,
  Receipt,
  Package,
  Smartphone,
} from 'lucide-react';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32">
      {/* Halos d'ambiance et grille or */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-amber-500/15 via-yellow-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/4 right-10 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Badge supérieur Sera UI */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium backdrop-blur-md shadow-inner shadow-amber-500/20">
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span>Architecture Multi-Tenant MongoDB + POS Caisse Intégré</span>
          </div>
        </div>

        {/* Titre Principal Haute Définition */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.15]">
            L'ERP & Caisse d'Élite pour boutiques{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-amber-500">
              High-Tech & Ateliers SAV
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Pilotez vos ventes au comptoir, vos tarifs revendeurs, vos réceptions de commandes,
            vos dossiers de réparations et vos garanties en toute étanchéité avec base de données dédiée par établissement.
          </p>

          {/* Boutons d'Action */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/register">
              <GlowButton variant="gold" className="text-base px-8 py-4 shadow-xl shadow-amber-500/25">
                Déployer ma Boutique en 30s
                <ArrowRight size={18} />
              </GlowButton>
            </Link>
            <Link href="/login">
              <ShimmerButton className="text-base px-8 py-4">
                <Store size={18} className="text-amber-400" />
                Accès Caisse & Staff
              </ShimmerButton>
            </Link>
          </div>

          {/* Atouts certifiés */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-amber-400" />
              <span>Devise locale Francs CFA (F)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-amber-400" />
              <span>Factures tickets thermiques & A4</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-amber-400" />
              <span>Gestion double tarif revendeur</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-amber-400" />
              <span>Connexion instantanée par téléphone</span>
            </div>
          </div>
        </div>

        {/* Maquette Interactive Live Preview */}
        <div className="mt-16 relative max-w-5xl mx-auto">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-amber-500/40 via-yellow-500/20 to-amber-600/40 blur-xl opacity-75 -z-10" />
          <div className="rounded-2xl border border-zinc-700/80 bg-zinc-950/90 overflow-hidden shadow-2xl backdrop-blur-2xl">
            {/* Barre de fenêtre macOS style */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/70">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-xs text-zinc-400 font-mono">zaff.app/caisse-pos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Caisse Ouverte • Connecté à zaff_backend
                </span>
              </div>
            </div>

            {/* Aperçu du Cockpit */}
            <div className="p-6 lg:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-gradient-to-b from-zinc-900/40 to-transparent">
              <SpotlightCard className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Chiffre du Jour</p>
                  <TrendingUp className="text-emerald-400" size={18} />
                </div>
                <div className="mt-3">
                  <p className="text-2xl lg:text-3xl font-bold text-white font-mono">
                    <NumberTicker value={1450000} suffix=" F" />
                  </p>
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                    +32% vs hier • 18 transactions
                  </p>
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Bénéfice Net Réel</p>
                  <ShieldCheck className="text-amber-400" size={18} />
                </div>
                <div className="mt-3">
                  <p className="text-2xl lg:text-3xl font-bold text-amber-400 font-mono">
                    <NumberTicker value={420000} suffix=" F" />
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Marges calculées en temps réel
                  </p>
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Atelier SAV</p>
                  <Wrench className="text-blue-400" size={18} />
                </div>
                <div className="mt-3">
                  <p className="text-2xl lg:text-3xl font-bold text-white font-mono">
                    <NumberTicker value={7} suffix=" en cours" />
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    4 terminés prêts pour restitution
                  </p>
                </div>
              </SpotlightCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
