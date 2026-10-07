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
  /** Client (renvoyé peuplé par l'API) */
  customerId?: { _id: string; name: string; phone?: string | null } | null;
  createdAt?: string;
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

export interface PaymentTotals {
  cash: number;
  mobile: number;
  card: number;
  bank_transfer: number;
  credit: number;
}

/** Caisse en cours d'un collaborateur (ventes pas encore clôturées) */
export interface CurrentRegister {
  totals: PaymentTotals;
  totalAmount: number;
  salesCount: number;
  itemsCount: number;
  expectedCash: number;
  since: string | null;
  lastClosedAt: string | null;
  sales: Pick<Sale, '_id' | 'invoiceNumber' | 'total' | 'paymentMethod' | 'saleDate' | 'items'>[];
}

export interface CashClosing {
  _id: string;
  sellerId: string;
  sellerName: string;
  openedAt: string;
  closedAt: string;
  salesCount: number;
  totals: PaymentTotals;
  totalAmount: number;
  expectedCash: number;
  declaredCash: number;
  cashDifference: number;
  notes?: string | null;
  status: 'submitted' | 'validated';
  validatedByName?: string | null;
  validatedAt?: string | null;
  ownerNotes?: string | null;
}

/** Propriétaire : caisse encore ouverte d'un vendeur */
export interface OpenRegister {
  sellerId: string;
  sellerName: string;
  totals: PaymentTotals;
  totalAmount: number;
  salesCount: number;
  since: string;
  lastSaleAt: string;
}

export const PAYMENT_LABELS: Record<keyof PaymentTotals, string> = {
  cash: 'Espèces',
  mobile: 'Mobile Money',
  card: 'Carte',
  bank_transfer: 'Virement',
  credit: 'Crédit',
};

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Une erreur est survenue');
