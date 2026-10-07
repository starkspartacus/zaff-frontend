'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { isOwner, ROLE_LABELS } from '@/lib/roles';
import { LiveStatus, NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeToggle } from './theme-toggle';
import { Menu, ShoppingCart, Wrench, Sparkles, ScanLine, PackagePlus, LayoutGrid } from 'lucide-react';

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
    <header className="h-16 px-3 sm:px-6 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/80 flex items-center justify-between sticky top-0 z-30">
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
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            <span className="font-semibold">{establishment?.name || 'Zaff'}</span>
            <span className="text-neutral-500">•</span>
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider">{establishment?.currency || 'F CFA'}</span>
          </div>

          <span className="hidden md:inline-block text-xs text-neutral-400 capitalize">
            {currentDate}
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <LiveStatus className="hidden md:flex" />

        {/* Action rapide selon le rôle */}
        {user?.role === 'storekeeper' ? (
          <QuickAction href="/app/receive" icon={PackagePlus} label="Mise en stock" />
        ) : user?.role === 'seller' ? (
          <>
            <Link
              href="/app/showcase"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700/80 text-neutral-200 hover:border-gold/50 font-medium text-xs"
              aria-label="Vitrine"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-gold" /> <span className="hidden sm:inline">Vitrine</span>
            </Link>
            <QuickAction href="/app/scan" icon={ScanLine} label="Vendre" />
          </>
        ) : (
          <>
            <QuickAction href="/app/scan" icon={ScanLine} label="Vendre" />
            <Link
              href="/app/sales"
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700/80 text-neutral-200 hover:text-white hover:border-gold/50 font-medium text-xs transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-gold" />
              <span>Caisse</span>
            </Link>
            {isOwner(user?.role) && (
              <Link
                href="/app/repairs"
                className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700/80 text-neutral-200 hover:text-white hover:border-gold/50 font-medium text-xs transition-all"
              >
                <Wrench className="w-3.5 h-3.5 text-gold" />
                <span>Atelier SAV</span>
              </Link>
            )}
          </>
        )}

        <ThemeToggle />
        <NotificationBell />

        {/* User Mini Tag */}
        <div className="hidden lg:flex items-center gap-2.5 pl-3 border-l border-neutral-800">
          <div className="text-right">
            <p className="text-xs font-medium text-white">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-gold uppercase tracking-wider font-semibold">{user ? ROLE_LABELS[user.role] : ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-gold to-gold-deep text-ink font-semibold text-xs hover:brightness-110 transition-all shadow-sm shadow-gold/20"
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </Link>
  );
}
