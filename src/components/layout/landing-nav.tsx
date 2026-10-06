'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/ui/logo';
import { GlowButton } from '@/components/seraui/glow-button';
import { ShimmerButton } from '@/components/seraui/shimmer-button';
import { Menu, X, Sparkles, Store, Shield, ArrowRight } from 'lucide-react';

export function LandingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo size={42} showText={false} className="transition-transform group-hover:scale-105 duration-300" />
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-amber-500">
              Zaff
            </span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium">
              ERP & POS High-Tech
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
          <a href="#features" className="hover:text-amber-400 transition-colors">Fonctionnalités</a>
          <a href="#pos" className="hover:text-amber-400 transition-colors">Caisse & Revendeurs</a>
          <a href="#sav" className="hover:text-amber-400 transition-colors">Atelier SAV</a>
          <a href="#multitenant" className="hover:text-amber-400 transition-colors">Multi-Boutique</a>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/login">
            <ShimmerButton className="px-4 py-2 text-xs">
              <Store size={15} className="text-amber-400" />
              Connexion Boutique
            </ShimmerButton>
          </Link>
          <Link href="/register">
            <GlowButton variant="gold" className="px-5 py-2 text-xs">
              Créer mon établissement
              <ArrowRight size={14} />
            </GlowButton>
          </Link>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-zinc-400 hover:text-white"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-950 border-b border-zinc-800 px-6 py-6 space-y-4">
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-amber-400">Fonctionnalités</a>
          <a href="#pos" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-amber-400">Caisse & Revendeurs</a>
          <a href="#sav" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-amber-400">Atelier SAV</a>
          <a href="#multitenant" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-amber-400">Multi-Boutique</a>
          <div className="pt-4 flex flex-col gap-3">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-2.5 rounded-xl border border-zinc-700 text-sm font-medium text-white">
              Connexion Boutique
            </Link>
            <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-semibold text-sm">
              Créer mon établissement
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
