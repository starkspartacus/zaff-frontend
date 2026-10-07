/** Types des objets renvoyés par l'API (champs utilisés par les écrans) */

export interface Category {
  _id: string;
  name: string;
  slug: string;
}

export interface Product {
  _id: string;
  name: string;
  sku: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  barcode?: string | null;
  purchasePrice?: number;
  salePrice: number;
  resellerPrice?: number;
  stockQuantity: number;
  minStockAlert?: number;
  hasSerialNumbers?: boolean;
}

export type UnitStatus = 'in_stock' | 'sold' | 'defective';

export interface ProductUnit {
  _id: string;
  serialNumber: string;
  status: UnitStatus;
  /** Produit (renvoyé peuplé par l'API) */
  productId: Product | null;
  addedByName?: string | null;
  invoiceNumber?: number | null;
  soldByName?: string | null;
  soldAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  serialNumber?: string | null;
}

export interface Sale {
  _id: string;
  invoiceNumber: number;
  total: number;
  paymentMethod: string;
  saleDate: string;
  sellerName?: string | null;
  items: SaleItem[];
}

export type ScanLookup =
  | { type: 'unit'; unit: ProductUnit; product: Product; sellable: boolean }
  | { type: 'product'; product: Product; availableUnits: number };

export interface AddUnitsResult {
  created: ProductUnit[];
  rejected: { serialNumber: string; reason: string }[];
  stockQuantity: number;
}

export interface MyStats {
  sales: { count: number; revenue: number; items: number; recent: Sale[] };
  stocking: { unitsAdded: number; recent: ProductUnit[] };
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Une erreur est survenue');
