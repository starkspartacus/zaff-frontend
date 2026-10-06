import React from 'react';
import Logo from '@/components/ui/logo';

export function LandingFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-12 text-zinc-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Logo size={36} showText={false} />
          <span className="font-serif font-bold text-amber-400 text-base">Zaff</span>
          <span className="text-xs text-zinc-500">| Solution ERP & Caisse Multi-Tenant</span>
        </div>
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} Zaff. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
