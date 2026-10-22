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
  /** Appareil du catalogue global (photos, fiche technique) */
  deviceId?: string | null;
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
  customerId?: { _id: string; name: string; phone?: string | null; isReseller?: boolean } | null;
  createdAt?: string;
  items: SaleItem[];
  subtotal?: number;
  discount?: number;
  /** Montant remis par le client (espèces : monnaie rendue = remis − total) */
  paidAmount?: number | null;
  saleType?: 'purchase' | 'reseller';
  /** Vente à crédit : acompte versé, reste à payer, statut */
  depositAmount?: number;
  depositMethod?: string | null;
  amountDue?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  returnStatus?: 'partial' | 'returned' | null;
  returnedAmount?: number;
}

/** Client ou revendeur de la boutique */
export interface Customer {
  _id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  companyName?: string | null;
  notes?: string | null;
  isReseller?: boolean;
  totalPurchases?: number;
  /** Reste à payer (ventes à crédit) */
  balance?: number;
  createdAt?: string;
}

/** Argent reçu d'un client à crédit (acompte, versement) ou remboursé (montant négatif) */
export interface CustomerPayment {
  _id: string;
  customerId: string;
  amount: number;
  method: string;
  kind: 'deposit' | 'payment' | 'refund';
  allocations: { saleId: string; invoiceNumber: number; amount: number }[];
  notes?: string | null;
  collectedByName?: string | null;
  createdAt: string;
}

export interface CustomerDetail {
  customer: Customer;
  sales: Sale[];
  payments: CustomerPayment[];
}

export type ScanLookup =
  | {
      type: 'unit';
      unit: ProductUnit;
      product: Product;
      sellable: boolean;
      /** Appareil chez un revendeur : à qui, depuis quand */
      consignment?: { id: string; code: string; customerName: string; daysOut: number; dueAt: string; overdue: boolean } | null;
    }
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
  /** Acomptes et paiements des clients à crédit encaissés */
  collections?: { amount: number; count: number };
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

/** Appareil confié à un revendeur */
export interface ConsignmentItem {
  unitId: string;
  productId: string;
  productName: string;
  serialNumber: string;
  price: number;
  status: 'out' | 'sold' | 'returned';
  closedAt: string | null;
  closedByName: string | null;
  invoiceNumber: number | null;
}

/** Bon de remise à un revendeur (dépôt) */
export interface Consignment {
  id: string;
  _id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  items: ConsignmentItem[];
  dueAt: string;
  days: number;
  notes: string | null;
  handedByName: string | null;
  status: 'open' | 'closed';
  createdAt: string;
  closedAt: string | null;
  daysOut: number;
  overdue: boolean;
  outCount: number;
  outValue: number;
}

export interface ConsignmentSummary {
  units: number;
  value: number;
  overdueUnits: number;
  resellers: number;
  consignments: number;
}

/** Rapport de clôture de caisse */
export interface ClosingReport {
  code: string;
  subject: string;
  text: string;
  html: string;
  ownerPhone: string | null;
  emailedTo: string[];
  emailedAt: string | null;
  mailEnabled: boolean;
}

// ─── Fournisseurs et commandes ───
export interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  ordersCount: number;
  openOrders: number;
  amountDue: number;
  totalPurchased: number;
}

export type PurchaseOrderStatus = 'pending' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  hasSerialNumbers: boolean;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  _id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedAt: string | null;
  status: PurchaseOrderStatus;
  totalAmount: number;
  paidAmount: number;
  amountDue: number;
  items: PurchaseOrderItem[];
  receptions: Array<{ at: string; byName: string | null; lines: Array<{ productId: string; productName: string; quantity: number }> }>;
  payments: Array<{ at: string; amount: number; method: string; byName: string | null; note: string | null }>;
  createdByName: string | null;
  notes: string | null;
  remaining: number;
  late: boolean;
  supplier?: Supplier | null;
}

export interface PurchaseSummary {
  openOrders: number;
  lateOrders: number;
  amountDue: number;
  toReceive: number;
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  hasSerialNumbers: boolean;
  stockQuantity: number;
  minStockAlert: number;
  onOrder: number;
  suggestedQty: number;
  lastSupplierId: string | null;
  lastSupplierName: string | null;
  lastUnitPrice: number;
}

export interface ReceiveResult {
  order: PurchaseOrder;
  received: number;
  results: Array<{ productId: string; productName: string; received: number; rejected: Array<{ serialNumber: string; reason: string }> }>;
}

// ─── Inventaire par scan ───
export interface StockCountReport {
  expectedUnits: number;
  foundUnits: number;
  missing: Array<{ unitId: string; serialNumber: string; productId: string; productName: string; addedAt: string | null; value: number }>;
  missingValue: number;
  unexpected: Array<{ serialNumber: string; productName: string; status: string; reason: string; duringCount: boolean }>;
  unknownCodes: string[];
  plain: Array<{ productId: string; productName: string; expected: number; counted: number | null; difference: number | null; applied: boolean }>;
  adjustedProducts: number;
  notCounted: number;
}

export interface StockCount {
  _id: string;
  code: string;
  category: string | null;
  status: 'open' | 'closing' | 'closed' | 'cancelled';
  startedByName: string | null;
  startedAt: string;
  closedAt: string | null;
  closedByName: string | null;
  scannedBy: string[];
  unknownCodes?: string[];
  report: StockCountReport | null;
  progress?: {
    expectedUnits: number;
    foundUnits: number;
    scannedCodes: number;
    byProduct: Array<{ productId: string; productName: string; expected: number; found: number }>;
    plain: Array<{ productId: string; productName: string; expected: number; counted: number | null }>;
  };
}

export interface StockCountScan {
  kind: 'unit' | 'box' | 'product' | 'unknown';
  result?: 'found' | 'already' | 'unexpected' | 'other_category' | 'counted';
  serialNumber?: string;
  productId?: string;
  productName?: string;
  counted?: number;
  message: string;
}

// ─── Codes appareils générés (QR / code-barres) ───
export interface CodeSeries {
  _id: string;
  category: string;
  prefix: string;
  generatedCount: number;
  usedCount: number;
  locked: boolean;
  createdByName: string | null;
}

export interface CodeBatch {
  _id: string;
  code: string;
  category: string;
  prefix: string;
  fromSeq: number;
  toSeq: number;
  count: number;
  codes?: string[];
  productId: string | null;
  productName: string | null;
  createdByName: string | null;
  createdAt: string;
  usedCount: number;
  printCount: number;
  prints?: Array<{ at: string; byName: string; format: string; count: number }>;
  items?: Array<{ code: string; used: boolean; status: string | null; productName: string | null }>;
}

// ─── Réceptions de marchandise (ravitaillements) ───
export interface StockReceptionLine {
  productId: string;
  productName: string;
  category: string;
  categoryName: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  quantity: number;
  serialNumbers: string[];
  unitCost: number;
}

export interface StockReception {
  _id: string;
  code: string;
  source: 'scan' | 'purchase_order';
  orderCode: string | null;
  supplierName: string | null;
  note: string | null;
  receivedByName: string | null;
  createdAt: string;
  totalUnits: number;
  totalValue: number;
  byCategory: Array<{ category: string; categoryName: string; quantity: number }>;
  modelsCount?: number;
  lines?: StockReceptionLine[];
  rejected?: Array<{ productName: string; serialNumber: string; reason: string }>;
}

export interface ReceptionResult {
  reception: StockReception | null;
  results: Array<{ productId: string; created: string[]; rejected: Array<{ serialNumber: string; reason: string }> }>;
}

/** Stock par modèle et capacité (`GET /stock/models`) : une version = une fiche produit (capacité, couleur, état) */
export interface StockVersion {
  productId: string;
  sku: string | null;
  capacity: string | null;
  color: string | null;
  condition: 'new' | 'refurbished' | 'used';
  imageId: string | null;
  tracked: boolean;
  inStock: number;
  consigned: number;
  defective: number;
  inRepair: number;
  sold: number;
  salePrice: number;
  resellerPrice: number;
  /** Propriétaire et magasinier seulement */
  purchasePrice?: number;
  value?: number;
  saleValue: number;
  minStockAlert: number;
  coverDays: number | null;
  avgAgeDays: number | null;
  oldestDays: number | null;
  agingUnits: number;
  status: 'out' | 'low' | 'ok';
  reorder: number;
}

export interface StockFamily {
  key: string;
  category: string;
  brand: string | null;
  name: string;
  deviceId: string | null;
  imageId: string | null;
  versions: StockVersion[];
  inStock: number;
  consigned: number;
  defective: number;
  inRepair: number;
  sold: number;
  value?: number;
  saleValue: number;
  agingUnits: number;
  oldestDays: number | null;
  outVersions: number;
  lowVersions: number;
  reorder: number;
  capacities: Array<{ capacity: string | null; inStock: number; sold: number; fromPrice: number | null; colors: string[] }>;
}

export interface StockModels {
  periodDays: number;
  agingDays: number;
  totals: {
    families: number;
    versions: number;
    inStock: number;
    consigned: number;
    defective: number;
    inRepair: number;
    sold: number;
    value?: number;
    saleValue: number;
    agingUnits: number;
    outVersions: number;
    lowVersions: number;
  };
  families: StockFamily[];
}
