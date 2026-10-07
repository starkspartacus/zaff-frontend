'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Contrat de vente et garantie (voir zaff-backend `contracts/contract-template.ts`) */

export type ArticleKind = 'text' | 'seller' | 'customer' | 'product' | 'returns';
export type ProductCondition = 'new' | 'refurbished' | 'used';

export interface ContractArticle {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  kind: ArticleKind;
}

export interface ContractLegal {
  legalName: string;
  legalForm: string;
  activity: string;
  rccm: string;
  taxId: string;
  representative: string;
}

export interface ContractSettings {
  mode: 'default' | 'custom';
  legal: ContractLegal;
  title: string;
  subtitle: string;
  intro: string;
  articles: ContractArticle[];
  warrantyCard: boolean;
  version: number;
  updatedAt: string | null;
}

export interface ContractSettingsResponse {
  contract: ContractSettings;
  defaults: ContractSettings;
  placeholders: string[];
}

export interface ContractBlock {
  type: 'p' | 'li';
  text: string;
}

export interface ContractItem {
  productName: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  serialNumber: string | null;
  reference: string | null;
  condition: ProductCondition;
  accessories: string | null;
  quantity: number;
  price: number;
  warrantyMonths: number;
  warrantyStart: string;
  warrantyEnd: string | null;
}

export interface RenderedContract {
  documentNumber: string;
  version: number;
  sample: boolean;
  title: string;
  subtitle: string;
  lawReference: string | null;
  countryLine: string | null;
  intro: ContractBlock[];
  shop: {
    name: string;
    displayName: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    countryCode: string | null;
    countryName: string | null;
    currency: string;
    legal: ContractLegal;
  };
  customer: { name: string | null; phone: string | null; email: string | null; address: string | null } | null;
  sale: {
    id: string;
    invoiceNumber: number;
    date: string;
    subtotal: number;
    discount: number;
    total: number;
    creditNoteAmount: number;
    paymentLabel: string;
    sellerName: string | null;
  };
  items: ContractItem[];
  articles: Array<{ number: number; id: string; kind: ArticleKind; title: string; blocks: ContractBlock[] }>;
  warrantyCard: boolean;
}

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: 'Neuf',
  refurbished: 'Reconditionné',
  used: 'Occasion',
};

const contractKey = ['settings', 'sales-contract'] as const;

export const useContractSettings = () =>
  useQuery({
    queryKey: contractKey,
    queryFn: () => api.get('/settings/sales-contract') as unknown as Promise<ContractSettingsResponse>,
    staleTime: 5 * 60 * 1000,
  });

/** Ce que le serveur accepte (sans version / date, calculées par lui) */
const toPayload = (c: ContractSettings) => ({
  mode: c.mode,
  legal: c.legal,
  title: c.title,
  subtitle: c.subtitle,
  intro: c.intro,
  articles: c.mode === 'custom' ? c.articles : undefined,
  warrantyCard: c.warrantyCard,
});

export function useSaveContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: ContractSettings) => api.put('/settings/sales-contract', toPayload(c)) as unknown as Promise<ContractSettings>,
    onSuccess: (contract) =>
      qc.setQueryData<ContractSettingsResponse>(contractKey, (prev) => (prev ? { ...prev, contract } : prev)),
  });
}

export const previewContract = (c: ContractSettings) =>
  api.post('/settings/sales-contract/preview', toPayload(c)) as unknown as Promise<RenderedContract>;

/** Contrat d'une vente (le texte ne change plus : pas de rechargement en temps réel nécessaire) */
export const useSaleContract = (saleId: string | null) =>
  useQuery({
    queryKey: ['sales', 'contract', saleId],
    queryFn: () => api.get(`/sales/${saleId}/contract`) as unknown as Promise<RenderedContract>,
    enabled: !!saleId,
  });

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

export const formatMoney = (n: number, currency: string) => `${new Intl.NumberFormat('fr-FR').format(n || 0)} ${currency}`;

/** Message WhatsApp récapitulant l'achat et la garantie */
export function whatsappLink(doc: RenderedContract) {
  const lines = [
    `Bonjour${doc.customer?.name ? ` ${doc.customer.name}` : ''},`,
    `Merci pour votre achat chez ${doc.shop.displayName} (facture n° ${doc.sale.invoiceNumber} du ${formatDate(doc.sale.date)}).`,
    ...doc.items.map(
      (i) =>
        `• ${i.productName}${i.serialNumber ? ` — N° de série ${i.serialNumber}` : ''} : ${
          i.warrantyMonths > 0 ? `garantie ${i.warrantyMonths} mois, jusqu'au ${formatDate(i.warrantyEnd)}` : 'sans garantie commerciale'
        }`
    ),
    'Conservez ce message et votre contrat : ils vous seront demandés pour toute prise en charge.',
    doc.shop.phone ? `Service client : ${doc.shop.phone}` : '',
  ].filter(Boolean);
  const phone = (doc.customer?.phone || '').replace(/\D/g, '');
  return `https://wa.me/${phone.length >= 8 ? phone : ''}?text=${encodeURIComponent(lines.join('\n'))}`;
}
