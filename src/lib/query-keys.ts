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
  consignments: (status: string) => ['consignments', 'list', status] as const,
  consignmentSummary: () => ['consignments', 'summary'] as const,
  closingReport: (id: string) => ['cash-closings', 'report', id] as const,
  customers: (type: string) => ['customers', 'list', type] as const,
  customer: (id: string) => ['customers', 'detail', id] as const,
  stockOverview: () => ['stock', 'overview'] as const,
  stockMovements: (limit: number) => ['stock', 'movements', limit] as const,
  notifications: () => ['notifications'] as const,
  currentRegister: () => ['cash-closings', 'current'] as const,
  closings: (days: number, status: string) => ['cash-closings', 'list', days, status] as const,
  openRegisters: () => ['cash-closings', 'open'] as const,
  returnPolicy: () => ['settings', 'return-policy'] as const,
  returns: (days: number) => ['returns', days] as const,
};
