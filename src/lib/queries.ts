'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { NotificationSchema } from '@/lib/schemas';
import { z } from 'zod';
import type { AddUnitsResult, Category, MyStats, Product, ProductUnit, Sale } from '@/lib/types';

const get = <T,>(url: string) => api.get(url) as unknown as Promise<T>;
const post = <T,>(url: string, body?: unknown) => api.post(url, body) as unknown as Promise<T>;

export interface ReferenceCategory {
  _id: string;
  name: string;
  slug: string;
  brands: string[];
  serialTracked: boolean;
}

export interface DashboardStats {
  sales: { count: number; revenue: number; profit: number };
  inventory: { totalProducts: number; totalUnits: number; totalStockValue: number; lowStockCount: number };
  repairs: { pending: number; completed: number };
  bySeller: { sellerId: string | null; sellerName: string; count: number; revenue: number; lastSaleAt: string }[];
  topProducts: { productId: string; productName: string; quantitySold: number; totalRevenue: number }[];
}

// ─── Lectures ───────────────────────────────────────────────────────────────

export const useProducts = () => useQuery({ queryKey: qk.products(), queryFn: () => get<Product[]>('/catalog/products') });
export const useCategories = () => useQuery({ queryKey: qk.categories(), queryFn: () => get<Category[]>('/catalog/categories') });

/** Catalogue de référence commun à toutes les boutiques (base globale) : quasi statique */
export const useReferenceCatalog = () =>
  useQuery({ queryKey: qk.reference(), queryFn: () => get<ReferenceCategory[]>('/global/reference/catalog'), staleTime: 60 * 60 * 1000 });

export const useMyStats = (period: string) =>
  useQuery({ queryKey: qk.myStats(period), queryFn: () => get<MyStats>(`/analytics/me?period=${period}`) });

export const useDashboard = (period: string, enabled = true) =>
  useQuery({ queryKey: qk.dashboard(period), queryFn: () => get<DashboardStats>(`/analytics/dashboard?period=${period}`), enabled });

export const useRecentSales = (enabled = true) =>
  useQuery({ queryKey: qk.sales(), queryFn: () => get<Sale[]>('/sales'), enabled, select: (s) => s.slice(0, 5) });

export const useUnits = (filters: Record<string, string>) =>
  useQuery({
    queryKey: qk.units(filters),
    queryFn: () => get<ProductUnit[]>(`/units?${new URLSearchParams(filters)}`),
    placeholderData: (prev) => prev, // garde la liste affichée pendant une nouvelle recherche
  });

export const useNotificationsHistory = (enabled: boolean) =>
  useQuery({
    queryKey: qk.notifications(),
    queryFn: async () => z.array(NotificationSchema).parse(await get<unknown>('/notifications')),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

// ─── Écritures ──────────────────────────────────────────────────────────────

/** Après une écriture, on rafraîchit tout de suite chez soi (les autres écrans le sont par le WebSocket) */
function useInvalidate() {
  const qc = useQueryClient();
  return (...scopes: string[]) => scopes.forEach((s) => qc.invalidateQueries({ queryKey: [s] }));
}

export function useSellUnit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<{ sale: Sale; unit: ProductUnit }>('/units/sell', body),
    onSuccess: () => invalidate('my-stats', 'units', 'products', 'sales', 'dashboard'),
  });
}

export function useCreateSale() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<Sale>('/sales', body),
    onSuccess: () => invalidate('my-stats', 'units', 'products', 'sales', 'dashboard'),
  });
}

export function useAddUnits() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { productId: string; serialNumbers: string[] }) => post<AddUnitsResult>('/units', body),
    onSuccess: () => invalidate('my-stats', 'units', 'products', 'dashboard'),
  });
}

export function useDeleteUnit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/units/${id}`),
    onSuccess: () => invalidate('my-stats', 'units', 'products', 'dashboard'),
  });
}

export function useSetUnitStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'in_stock' | 'defective'; notes?: string }) =>
      api.patch(`/units/${id}/status`, body),
    onSuccess: () => invalidate('units', 'products', 'dashboard'),
  });
}
