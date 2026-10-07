export type Role = 'superadmin' | 'admin' | 'seller' | 'storekeeper';

/** « standard » est l'ancien nom du rôle vendeur */
export const normalizeRole = (role?: string | null): Role =>
  role === 'standard' ? 'seller' : ((role as Role) || 'seller');

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super administrateur',
  admin: 'Propriétaire',
  seller: 'Vendeur',
  storekeeper: 'Magasinier',
};

export const ROLE_DESCRIPTIONS: Record<Exclude<Role, 'superadmin'>, string> = {
  admin: 'Accès complet : équipe, prix, comptabilité et tous les écrans.',
  seller: 'Vend en scannant les appareils et voit ses ventes du jour.',
  storekeeper: 'Crée les modèles et met les appareils en stock en scannant leur N° de série.',
};

/** Page d'accueil de chaque rôle */
export const ROLE_HOME: Record<Role, string> = {
  superadmin: '/app',
  admin: '/app',
  seller: '/app/scan',
  storekeeper: '/app/receive',
};

/** Pages accessibles (préfixes) pour les rôles non propriétaires */
const ROLE_PAGES: Partial<Record<Role, string[]>> = {
  seller: ['/app/scan', '/app/my-activity', '/app/cash-closing', '/app/sales', '/app/stock', '/app/customers', '/app/repairs', '/app/warranties'],
  storekeeper: ['/app/receive', '/app/my-activity', '/app/catalog', '/app/stock', '/app/suppliers'],
};

export const isOwner = (role?: string | null) => {
  const r = normalizeRole(role);
  return r === 'admin' || r === 'superadmin';
};

export const canAccess = (role: string | null | undefined, path: string) => {
  if (isOwner(role)) return true;
  const pages = ROLE_PAGES[normalizeRole(role)] || [];
  return pages.some((p) => path === p || path.startsWith(`${p}/`));
};
