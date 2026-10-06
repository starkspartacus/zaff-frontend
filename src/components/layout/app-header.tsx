'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Menu, ShoppingCart, Wrench, Bell, Sparkles } from 'lucide-react';

interface AppHeaderProps {
  onToggleSidebar?: () => void;
}

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const { user, establishment } = useAuth();

  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="h-16 px-6 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/80 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Store Title & Breadcrumb */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4a017]/10 border border-[#d4a017]/30 text-[#d4a017] text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            <span className="font-semibold">{establishment?.name || 'Zaff'}</span>
            <span className="text-neutral-500"></span>
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider">{establishment?.currency || 'F CFA'}</span>
          </div>

          <span className="hidden md:inline-block text-xs text-neutral-400 capitalize">
            {currentDate}
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Fast Action: POS */}
        <Link
          href="/app/sales"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black font-semibold text-xs hover:brightness-110 transition-all shadow-sm shadow-[#d4a017]/20"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Caisse POS</span>
        </Link>

        {/* Fast Action: SAV */}
        <Link
          href="/app/repairs"
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700/80 text-neutral-200 hover:text-white hover:border-[#d4a017]/50 font-medium text-xs transition-all"
        >
          <Wrench className="w-3.5 h-3.5 text-[#d4a017]" />
          <span>Atelier SAV</span>
        </Link>

        {/* Notification bell (visual) */}
        <button className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#d4a017]" />
        </button>

        {/* User Mini Tag */}
        <div className="hidden lg:flex items-center gap-2.5 pl-3 border-l border-neutral-800">
          <div className="text-right">
            <p className="text-xs font-medium text-white">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-[#d4a017] uppercase tracking-wider font-semibold">{user?.role || 'Manager'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
