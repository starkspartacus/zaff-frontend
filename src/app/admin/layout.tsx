'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Flag, ImagePlus, LayoutDashboard, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { useAdminStore } from '@/stores/admin-store';
import { applyTheme, useThemeStore } from '@/stores/theme-store';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/devices', label: 'Appareils', icon: Smartphone },
  { href: '/admin/import', label: 'Import de photos', icon: ImagePlus },
  { href: '/admin/reports', label: 'Signalements', icon: Flag },
];

/** Espace de l'administrateur de la plateforme ZAFF : catalogue global des appareils et de leurs photos */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, email, hydrated, clear } = useAdminStore();
  const theme = useThemeStore((s) => s.theme);
  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    applyTheme(theme);
    return () => applyTheme(null);
  }, [theme]);

  useEffect(() => {
    if (hydrated && !token && !isLogin) router.replace('/admin/login');
  }, [hydrated, token, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!hydrated || !token) return <div className="min-h-screen bg-black" />;

  return (
    <div className="app-main min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          <Logo size="sm" />
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Administration ZAFF
          </span>
          <nav className="flex-1 flex justify-center gap-1 overflow-x-auto">
            {NAV.map(({ href, label, icon: Icon }) => {
              const on = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href) || (href === '/admin/devices' && pathname.startsWith('/admin/device'));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'h-10 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors',
                    on ? 'bg-gold/15 text-gold-soft' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  )}
                >
                  <Icon className="w-4 h-4" /> <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
          <button
            onClick={() => {
              clear();
              router.replace('/admin/login');
            }}
            className="h-10 px-3 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white text-xs flex items-center gap-1.5"
            title={email || ''}
          >
            <LogOut className="w-4 h-4" /> <span className="hidden lg:inline">Déconnexion</span>
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
