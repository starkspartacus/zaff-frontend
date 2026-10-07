'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Logo } from '@/components/ui/logo';
import { canAccess, normalizeRole, ROLE_HOME, ROLE_LABELS } from '@/lib/roles';
import {
  LayoutGrid,
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Boxes,
  Layers,
  Users,
  Wrench,
  ShieldCheck,
  Truck,
  UserCheck,
  LogOut,
  ChevronRight,
  Store,
  ScanLine,
  PackagePlus,
  CalendarCheck,
  Lock,
  Wallet,
  Undo2,
  Settings,
} from 'lucide-react';

interface NavGroup {
  label: string;
  items: {
    title: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Au quotidien',
    items: [
      { title: 'Vendre (scan)', href: '/app/scan', icon: ScanLine, badge: 'Scan' },
      { title: 'Vitrine des articles', href: '/app/showcase', icon: LayoutGrid },
      { title: 'Retours & garantie', href: '/app/returns', icon: Undo2 },
      { title: 'Mise en stock (scan)', href: '/app/receive', icon: PackagePlus },
      { title: 'Mon activité du jour', href: '/app/my-activity', icon: CalendarCheck },
      { title: 'Clôturer ma caisse', href: '/app/cash-closing', icon: Lock },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { title: 'Cockpit Rapide', href: '/app', icon: LayoutDashboard },
      { title: 'Analytics & Chiffres', href: '/app/dashboard', icon: TrendingUp },
      { title: 'Clôtures de caisse', href: '/app/cash-closings', icon: Wallet },
    ],
  },
  {
    label: 'Caisse & Commercial',
    items: [
      { title: 'Caisse Tactile POS', href: '/app/sales', icon: ShoppingCart, badge: 'Live' },
      { title: 'Factures & Ventes', href: '/app/invoices', icon: Receipt },
      { title: 'Clients & Revendeurs', href: '/app/customers', icon: Users },
    ],
  },
  {
    label: 'Stock & Articles',
    items: [
      { title: 'Catalogue Produits', href: '/app/catalog', icon: Boxes },
      { title: 'Niveaux & Mouvements', href: '/app/stock', icon: Layers },
      { title: 'Fournisseurs & Achats', href: '/app/suppliers', icon: Truck },
    ],
  },
  {
    label: 'Service Après-Vente',
    items: [
      { title: 'Réparations Atelier', href: '/app/repairs', icon: Wrench },
      { title: 'Garanties & N° Série', href: '/app/warranties', icon: ShieldCheck },
    ],
  },
  {
    label: 'Administration',
    items: [
      { title: 'Équipe & Accès', href: '/app/users', icon: UserCheck },
      { title: 'Paramètres boutique', href: '/app/settings', icon: Settings },
    ],
  },
];

export function AppSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, establishment, logout } = useAuth();
  const role = normalizeRole(user?.role);
  // Le propriétaire n'a pas de « Mon activité » : il voit tout dans le cockpit
  const groups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => canAccess(role, i.href) && !(i.href === '/app/my-activity' && role === 'admin')
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="w-72 h-full bg-neutral-950/95 backdrop-blur-md border-r border-neutral-800/80 flex flex-col justify-between select-none">
      {/* Top Header */}
      <div className="p-5 pb-3">
        <Link href={ROLE_HOME[role]} onClick={onClose} className="block">
          <Logo size="sm" />
        </Link>

        {/* Current Active Boutique */}
        <div className="mt-4 p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-gold shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {establishment?.name || 'Boutique'}
              </p>
              <p className="text-[10px] text-neutral-400 font-mono truncate">
                {establishment?.slug || 'tenant'}
              </p>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Connecté" />
        </div>
      </div>

      {/* Nav Menu Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-5 scrollbar-thin scrollbar-thumb-neutral-800">
        {groups.map((group, idx) => (
          <div key={idx}>
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                      isActive
                        ? 'bg-gradient-to-r from-gold/20 to-gold/5 text-gold-soft border border-gold/30 shadow-sm shadow-gold/10'
                        : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive
                            ? 'text-gold'
                            : 'text-neutral-500 group-hover:text-neutral-300'
                        }`}
                      />
                      <span>{item.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className="text-[9px] font-semibold bg-gold/20 text-gold px-1.5 py-0.5 rounded-full border border-gold/30">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-gold" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom User Card */}
      <div className="p-4 border-t border-neutral-900 bg-neutral-950">
        <div className="p-3 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gold to-amber-200 text-ink font-bold text-xs flex items-center justify-center shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Utilisateur'}</p>
              <p className="text-[10px] text-neutral-400">{ROLE_LABELS[role]}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
