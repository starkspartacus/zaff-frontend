/**
 * Clés React Query. Le 1er segment correspond aux « scopes » envoyés par le serveur
 * dans `data:invalidate` : invalider ['products'] rafraîchit tout ce qui commence par 'products'.
 */
export const qk = {
  products: () => ['products', 'list'] as const,
  categories: () => ['products', 'categories'] as const,
  brands: () => ['products', 'brands'] as const,
  reference: () => ['reference'] as const,
  units: (filters: Record<string, string>) => ['units', filters] as const,
  myStats: (period: string) => ['my-stats', period] as const,
  dashboard: (period: string) => ['dashboard', period] as const,
  sales: () => ['sales'] as const,
  notifications: () => ['notifications'] as const,
};
