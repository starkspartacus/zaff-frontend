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
  ClosingReport,
  Consignment,
  ConsignmentSummary,
  Customer,
  CustomerDetail,
  CustomerPayment,
  MyStats,
  OpenRegister,
  Product,
  ProductReturn,
  ProductUnit,
  ReturnLookup,
  ReturnPolicy,
  Sale,
  PurchaseOrder,
  PurchaseSummary,
  ReceiveResult,
  ReorderSuggestion,
  Supplier,
  StockCount,
  StockCountScan,
  CodeSeries,
  CodeBatch,
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
  sales: {
    count: number;
    revenue: number;
    profit: number;
    /** Retours de la période (déduits du CA) */
    returns?: { count: number; amount: number };
    netRevenue?: number;
    /** Argent encore dû par les clients à crédit */
    receivables?: { amount: number; customers: number };
  };
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
  /** Fiche technique officielle */
  specs?: { label: string; value: string }[];
  /** Code couleur des coloris officiels (pastilles) */
  colorCodes?: { name: string; hex: string }[];
  /** Prix de vente pratiqué (médiane d'au moins 3 boutiques), par devise et capacité */
  prices?: { currency: string; variant: string | null; variantKey: string; median: number; shops: number }[];
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
// Le catalogue évolue (photos, fiches techniques ajoutées par ZAFF) : relu toutes les 10 min au plus
export const useDeviceCatalog = () =>
  useQuery({ queryKey: [...qk.reference(), 'devices'], queryFn: () => get<DeviceCatalog>('/global/reference/devices'), staleTime: 10 * 60 * 1000, gcTime: Infinity });

/** Appareil du catalogue global par son identifiant (fiche technique d'un produit) */
export function useCatalogDevice(deviceId?: string | null) {
  const { data } = useDeviceCatalog();
  if (!deviceId || !data) return undefined;
  for (const brands of Object.values(data.models)) for (const list of Object.values(brands)) for (const m of list) if (m.id === deviceId) return m;
  return undefined;
}

export const useBrands = () =>
  useQuery({ queryKey: qk.brands(), queryFn: () => get<Array<{ _id: string; name: string }>>('/catalog/brands') });

export const useMyStats = (period: string) =>
  useQuery({ queryKey: qk.myStats(period), queryFn: () => get<MyStats>(`/analytics/me?period=${period}`) });

export const useDashboard = (period: string, enabled = true) =>
  useQuery({ queryKey: qk.dashboard(period), queryFn: () => get<DashboardStats>(`/analytics/dashboard?period=${period}`), enabled });

export const useSales = (enabled = true) => useQuery({ queryKey: qk.sales(), queryFn: () => get<Sale[]>('/sales'), enabled });

export const useConsignments = (status: 'open' | 'closed' | 'all' = 'open', enabled = true) =>
  useQuery({ queryKey: qk.consignments(status), queryFn: () => get<Consignment[]>(`/consignments?status=${status}`), enabled });

export const useConsignmentSummary = (enabled = true) =>
  useQuery({ queryKey: qk.consignmentSummary(), queryFn: () => get<ConsignmentSummary>('/consignments/summary'), enabled });

export const useClosingReport = (id: string | null) =>
  useQuery({ queryKey: qk.closingReport(id || ''), queryFn: () => get<ClosingReport>(`/cash-closings/${id}/report`), enabled: !!id });

export const useCustomers = (type: 'all' | 'resellers' | 'standard' | 'debtors' = 'all', enabled = true) =>
  useQuery({ queryKey: qk.customers(type), queryFn: () => get<Customer[]>(`/customers?type=${type}`), enabled });

export const useCustomer = (id: string | null) =>
  useQuery({ queryKey: qk.customer(id || ''), queryFn: () => get<CustomerDetail>(`/customers/${id}`), enabled: !!id });

export const useStockOverview = () =>
  useQuery({ queryKey: qk.stockOverview(), queryFn: () => get<{ totalProducts: number; lowStockCount: number; lowStockProducts: Product[]; products: Product[] }>('/stock/overview') });

/** Mouvement de stock (produit peuplé par l'API) */
export interface StockMovementRow {
  _id: string;
  productId: Product | string | null;
  movementType: 'in' | 'out' | 'adjustment';
  quantity: number;
  referenceType?: string;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export const useStockMovements = (limit = 100) =>
  useQuery({ queryKey: qk.stockMovements(limit), queryFn: () => get<StockMovementRow[]>(`/stock/movements?limit=${limit}`) });

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
    onSuccess: () => invalidate('my-stats', 'units', 'products', 'stock', 'sales', 'dashboard', 'cash-closings', 'customers'),
  });
}

export function useCreateSale() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<Sale>('/sales', body),
    onSuccess: () => invalidate('my-stats', 'units', 'products', 'stock', 'sales', 'dashboard', 'cash-closings', 'customers'),
  });
}

export function useCreateCustomer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<Customer>('/customers', body),
    onSuccess: () => invalidate('customers'),
  });
}

/** Encaisser un paiement d'un client à crédit (revendeur) */
export function useCustomerPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; amount: number; method: string; notes?: string }) =>
      post<{ payment: CustomerPayment; balance: number }>(`/customers/${id}/payments`, body),
    onSuccess: () => invalidate('customers', 'sales', 'cash-closings', 'dashboard', 'my-stats'),
  });
}

/** Retour de marchandise sur une facture (lot invendu d'un revendeur), propriétaire */
export function useReturnSaleItems() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ saleId, ...body }: { saleId: string; reason?: string; refundMethod?: string; items: { productId: string; quantity: number; serialNumber?: string }[] }) =>
      post<{ message: string; value: number; debtReduction: number; refundDue: number; refunded: number }>(`/sales/${saleId}/return`, body),
    onSuccess: () => invalidate('sales', 'units', 'products', 'stock', 'customers', 'dashboard', 'cash-closings'),
  });
}

/** Remettre des appareils à un revendeur */
export function useCreateConsignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<Consignment>('/consignments', body),
    onSuccess: () => invalidate('consignments', 'units', 'products', 'stock', 'customers', 'dashboard'),
  });
}

/** Retour du revendeur : appareils vendus (il paie) et / ou rendus (remis en stock) */
export function useSettleConsignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; sold?: string[]; returned?: string[]; paymentMethod?: string; depositAmount?: number; depositMethod?: string }) =>
      post<{ consignment: Consignment; sale: Sale | null }>(`/consignments/${id}/settle`, body),
    onSuccess: () => invalidate('consignments', 'units', 'products', 'stock', 'customers', 'sales', 'cash-closings', 'dashboard', 'my-stats'),
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

// ─── Fournisseurs et commandes ───
export const useSuppliers = () => useQuery({ queryKey: qk.suppliers(), queryFn: () => get<Supplier[]>('/suppliers') });
export const usePurchaseOrders = (status: 'open' | 'closed' | 'unpaid' | 'all') =>
  useQuery({ queryKey: qk.purchaseOrders(status), queryFn: () => get<PurchaseOrder[]>(`/suppliers/orders${status === 'all' ? '' : `?status=${status}`}`) });
export const usePurchaseSummary = (enabled = true) =>
  useQuery({ queryKey: qk.purchaseSummary(), queryFn: () => get<PurchaseSummary>('/suppliers/orders/summary'), enabled });
export const useReorderSuggestions = () => useQuery({ queryKey: qk.reorderSuggestions(), queryFn: () => get<ReorderSuggestion[]>('/suppliers/orders/suggestions') });

export function useSaveSupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; notes?: string }) =>
      (id ? api.put(`/suppliers/${id}`, body) : api.post('/suppliers', body)) as unknown as Promise<Supplier>,
    onSuccess: () => invalidate('suppliers'),
  });
}

export function useCreatePurchaseOrder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { supplierId: string; items: Array<{ productId: string; quantity: number; unitPrice?: number }>; expectedAt?: string; notes?: string }) =>
      post<PurchaseOrder>('/suppliers/orders', body),
    onSuccess: () => invalidate('suppliers'),
  });
}

export function useReceivePurchaseOrder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; items: Array<{ productId: string; quantity?: number; serialNumbers?: string[] }> }) =>
      post<ReceiveResult>(`/suppliers/orders/${id}/receive`, body),
    onSuccess: () => invalidate('suppliers', 'products', 'units', 'stock', 'dashboard'),
  });
}

export function usePurchaseOrderAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'close' | 'cancel' }) => api.patch(`/suppliers/orders/${id}/${action}`, {}) as unknown as Promise<PurchaseOrder>,
    onSuccess: () => invalidate('suppliers'),
  });
}

export function usePaySupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; amount: number; method: string; note?: string }) => post<PurchaseOrder>(`/suppliers/orders/${id}/payments`, body),
    onSuccess: () => invalidate('suppliers'),
  });
}

// ─── Inventaire par scan ───
export const useCurrentStockCount = () => useQuery({ queryKey: qk.stockCountCurrent(), queryFn: () => get<StockCount | null>('/stock-counts/current') });
export const useStockCounts = (enabled = true) => useQuery({ queryKey: qk.stockCounts(), queryFn: () => get<StockCount[]>('/stock-counts'), enabled });
export const useStockCount = (id: string | null) =>
  useQuery({ queryKey: qk.stockCount(id || ''), queryFn: () => get<StockCount>(`/stock-counts/${id}`), enabled: !!id });

export function useStockCountAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (a: { kind: 'start'; category?: string } | { kind: 'close'; id: string; applyAdjustments: boolean } | { kind: 'cancel'; id: string }) =>
      (a.kind === 'start'
        ? api.post('/stock-counts', { category: a.category || undefined })
        : a.kind === 'close'
          ? api.post(`/stock-counts/${a.id}/close`, { applyAdjustments: a.applyAdjustments })
          : api.patch(`/stock-counts/${a.id}/cancel`, {})) as unknown as Promise<StockCount>,
    onSuccess: () => invalidate('stock-counts', 'products', 'stock'),
  });
}

export function useStockCountScan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (a: { id: string; code: string } | { id: string; productId: string; qty: number }) =>
      ('code' in a ? post<StockCountScan>(`/stock-counts/${a.id}/scan`, { code: a.code }) : post<StockCountScan>(`/stock-counts/${a.id}/count`, { productId: a.productId, qty: a.qty })),
    onSuccess: () => invalidate('stock-counts'),
  });
}

// ─── Codes appareils générés ───
export const useCodeSeries = () =>
  useQuery({ queryKey: qk.codeSeries(), queryFn: () => get<{ series: CodeSeries[]; suggestions: Array<{ category: string; prefix: string }> }>('/code-labels/series') });
export const useCodeBatches = () => useQuery({ queryKey: qk.codeBatches(), queryFn: () => get<CodeBatch[]>('/code-labels/batches') });
export const useCodeBatch = (id: string | null) =>
  useQuery({ queryKey: qk.codeBatch(id || ''), queryFn: () => get<CodeBatch>(`/code-labels/batches/${id}`), enabled: !!id });

export function useSaveCodeSeries() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (a: { id?: string; category: string; prefix: string } | { id: string; remove: true }) =>
      ('remove' in a
        ? api.delete(`/code-labels/series/${a.id}`)
        : a.id
          ? api.put(`/code-labels/series/${a.id}`, { category: a.category, prefix: a.prefix })
          : api.post('/code-labels/series', { category: a.category, prefix: a.prefix })) as unknown as Promise<CodeSeries>,
    onSuccess: () => invalidate('code-labels'),
  });
}

export function useGenerateCodes() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { seriesId: string; count: number; productId?: string }) => post<CodeBatch>('/code-labels/batches', body),
    onSuccess: () => invalidate('code-labels'),
  });
}

export function useMarkPrinted() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; format: 'a4' | 'thermal'; count?: number }) => post<{ ok: boolean }>(`/code-labels/batches/${id}/printed`, body),
    onSuccess: () => invalidate('code-labels'),
  });
}
