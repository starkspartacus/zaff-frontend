'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { NotificationSchema } from '@/lib/schemas';
import { z } from 'zod';
import type {
  AddUnitsResult,
  CashClosing,
  Category,
  CreditNoteInfo,
  CurrentRegister,
  MyStats,
  OpenRegister,
  Product,
  ProductReturn,
  ProductUnit,
  ReturnLookup,
  ReturnPolicy,
  Sale,
} from '@/lib/types';

const get = <T,>(url: string) => api.get(url) as unknown as Promise<T>;
const post = <T,>(url: string, body?: unknown) => api.post(url, body) as unknown as Promise<T>;

export interface ReferenceCategory {
  _id: string;
  name: string;
  slug: string;
  brands: string[];
  serialTracked: boolean;
  icon?: string;
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

export interface DeviceModel {
  /** Appareil du catalogue global */
  id?: string;
  name: string;
  variants?: string[];
  colors?: string[];
  /** Photos conformes par coloris (ajoutées par l'administrateur ZAFF) */
  photos?: { imageId: string; color: string | null }[];
  imageId?: string | null;
}
export interface CategoryProfile {
  variantLabel: string;
  variants: string[];
  colors: string[];
  accessories: string[];
  warrantyMonths: number;
}
export interface DeviceCatalog {
  profiles: Record<string, CategoryProfile>;
  defaultProfile: CategoryProfile;
  /** catégorie (slug) → marque → modèles */
  models: Record<string, Record<string, DeviceModel[]>>;
}

/** Appareils connus (modèles, capacités, coloris, accessoires) pour remplir vite une fiche produit */
export const useDeviceCatalog = () =>
  useQuery({ queryKey: [...qk.reference(), 'devices'], queryFn: () => get<DeviceCatalog>('/global/reference/devices'), staleTime: Infinity, gcTime: Infinity });

export const useBrands = () =>
  useQuery({ queryKey: qk.brands(), queryFn: () => get<Array<{ _id: string; name: string }>>('/catalog/brands') });

export const useMyStats = (period: string) =>
  useQuery({ queryKey: qk.myStats(period), queryFn: () => get<MyStats>(`/analytics/me?period=${period}`) });

export const useDashboard = (period: string, enabled = true) =>
  useQuery({ queryKey: qk.dashboard(period), queryFn: () => get<DashboardStats>(`/analytics/dashboard?period=${period}`), enabled });

export const useRecentSales = (enabled = true) =>
  useQuery({ queryKey: qk.sales(), queryFn: () => get<Sale[]>('/sales'), enabled, select: (s) => s.slice(0, 5) });

export const useUnits = (filters: Record<string, string>, enabled = true) =>
  useQuery({
    enabled,
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

// ─── Clôtures de caisse ───

export const useCurrentRegister = () =>
  useQuery({ queryKey: qk.currentRegister(), queryFn: () => get<CurrentRegister>('/cash-closings/current') });

export const useClosings = (days = 30, status = 'all') =>
  useQuery({ queryKey: qk.closings(days, status), queryFn: () => get<CashClosing[]>(`/cash-closings?days=${days}&status=${status}`) });

export const useOpenRegisters = (enabled = true) =>
  useQuery({ queryKey: qk.openRegisters(), queryFn: () => get<OpenRegister[]>('/cash-closings/open'), enabled });

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
    onSuccess: () => invalidate('my-stats', 'units', 'products', 'sales', 'dashboard', 'cash-closings'),
  });
}

export function useCreateSale() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<Sale>('/sales', body),
    onSuccess: () => invalidate('my-stats', 'units', 'products', 'sales', 'dashboard', 'cash-closings'),
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

export function useCloseRegister() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { declaredCash: number; notes?: string }) => post<CashClosing>('/cash-closings', body),
    onSuccess: () => invalidate('cash-closings', 'my-stats'),
  });
}

export function useValidateClosing() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.patch(`/cash-closings/${id}/validate`, { notes }),
    onSuccess: () => invalidate('cash-closings'),
  });
}

// ─── Retours, avoirs, paramètres ───

export const useReturnPolicy = () =>
  useQuery({ queryKey: qk.returnPolicy(), queryFn: () => get<ReturnPolicy>('/settings/return-policy'), staleTime: 5 * 60 * 1000 });

export function useUpdateReturnPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (policy: ReturnPolicy) => api.put('/settings/return-policy', policy) as unknown as Promise<ReturnPolicy>,
    onSuccess: (policy) => qc.setQueryData(qk.returnPolicy(), policy),
  });
}

export const useReturns = (days = 30) => useQuery({ queryKey: qk.returns(days), queryFn: () => get<ProductReturn[]>(`/returns?days=${days}`) });

export const lookupReturn = (serial: string) => get<ReturnLookup>(`/returns/lookup/${encodeURIComponent(serial)}`);
export const lookupCreditNote = (code: string) => get<CreditNoteInfo>(`/credit-notes/${encodeURIComponent(code.trim())}`);

export function useCreateReturn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<ProductReturn>('/returns', body),
    onSuccess: () => invalidate('returns', 'units', 'products', 'repairs', 'cash-closings', 'dashboard', 'my-stats'),
  });
}
