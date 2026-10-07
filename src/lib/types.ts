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
  condition?: 'new' | 'refurbished' | 'used';
  accessories?: string | null;
  /** Photo de la base d'images partagée */
  imageId?: string | null;
}

export type UnitStatus = 'in_stock' | 'sold' | 'defective' | 'in_repair';

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
  creditNoteCode?: string | null;
  creditNoteAmount?: number;
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

// ─── Retours, avoirs, garantie ───

export interface ActionToggles {
  creditNote: boolean;
  refund: boolean;
  exchange: boolean;
}

export interface ReturnPolicy {
  returnsEnabled: boolean;
  returnWindowDays: number;
  conditions: string[];
  changeOfMind: ActionToggles;
  restockingFeePercent: number;
  refundMethods: Array<'cash' | 'mobile'>;
  creditNoteValidityDays: number;
  defective: {
    exchangeWindowDays: number;
    earlyActions: ActionToggles;
    defaultWarrantyMonths: number;
    warrantyRepair: boolean;
    paidRepairOutOfWarranty: boolean;
  };
}

export type ReturnReason = 'change_of_mind' | 'defective';
export type ReturnAction = 'credit_note' | 'refund' | 'exchange' | 'warranty_repair' | 'paid_repair';

export interface ReturnOption {
  action: ReturnAction;
  label: string;
  description: string;
  amount?: number;
  refundMethods?: Array<'cash' | 'mobile'>;
}

export interface ReturnLookup {
  serialNumber: string;
  product: Pick<Product, '_id' | 'name' | 'brand' | 'model' | 'color'> | null;
  sale: {
    _id: string;
    invoiceNumber: number;
    saleDate: string;
    sellerName?: string | null;
    paymentMethod: string;
    customer: { _id: string; name: string; phone?: string | null } | null;
  };
  daysSincePurchase: number;
  price: number;
  warrantyEnd: string | null;
  underWarranty: boolean;
  changeOfMind: { allowed: boolean; reason?: string; options: ReturnOption[]; fee: number; conditions: string[] };
  defective: { allowed: boolean; reason?: string; options: ReturnOption[]; stage: 'early' | 'warranty' | 'out_of_warranty' };
}

export interface ProductReturn {
  _id: string;
  returnNumber: number;
  serialNumber: string;
  productName: string;
  invoiceNumber: number;
  reason: ReturnReason;
  action: ReturnAction;
  amount: number;
  fee: number;
  refundMethod?: 'cash' | 'mobile' | null;
  creditNoteCode?: string | null;
  repairTicketNumber?: number | null;
  unitStatusAfter: UnitStatus;
  processedByName: string;
  createdAt: string;
}

export interface CreditNoteInfo {
  code: string;
  amount: number;
  balance: number;
  status: 'active' | 'used' | 'expired';
  expiresAt: string;
  customerName?: string | null;
  usable: boolean;
  expired: boolean;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Une erreur est survenue');
