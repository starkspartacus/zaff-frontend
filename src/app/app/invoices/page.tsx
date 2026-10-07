'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  FileSignature,
  Receipt,
  Search,
  Printer,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Eye,
  Calendar,
  User,
  CheckCircle2,
  FileText,
} from 'lucide-react';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile: 'Mobile Money',
  card: 'Carte bancaire',
  bank_transfer: 'Virement',
  credit: 'Crédit',
};
const paymentLabel = (method?: string) => PAYMENT_LABELS[method || 'cash'] || method || 'Espèces';

export default function InvoicesPage() {
  const { establishment } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/sales');
      if (Array.isArray(res)) {
        setSales(res);
      }
    } catch (err) {
      console.error('Error fetching sales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const currency = establishment?.currency || 'F CFA';
  const formatPrice = (val: number) => `${(val || 0).toLocaleString('fr-FR')} ${currency}`;

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      String(s.invoiceNumber ?? '').includes(q) ||
      s.customerId?.name?.toLowerCase().includes(q) ||
      s.customerId?.phone?.includes(q) ||
      paymentLabel(s.paymentMethod).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-gold" />
            Factures & Historique des Ventes
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Consultez toutes les transactions encaissées, réimprimez les tickets et factures A4
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input
            type="text"
            placeholder="N° facture, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 rounded-xl h-10"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 border-b border-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">N° Facture</th>
                <th className="py-3.5 px-4">Date & Heure</th>
                <th className="py-3.5 px-4">Client</th>
                <th className="py-3.5 px-4">Articles</th>
                <th className="py-3.5 px-4">Règlement</th>
                <th className="py-3.5 px-4 text-right">Montant Total</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement des factures...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    Aucune facture trouvée.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-gold-soft">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      {new Date(sale.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white">
                      {sale.customerId?.name || 'Client Comptant'}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400">
                      {sale.items?.length || 0} article(s)
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-neutral-300 border border-neutral-800">
                        {paymentLabel(sale.paymentMethod)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-gold-soft">
                      {formatPrice(sale.total)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors inline-flex items-center gap-1.5"
                        title="Voir / Imprimer"
                      >
                        <Eye className="w-4 h-4 text-gold" />
                        <span className="text-[11px]">Détails</span>
                      </button>
                      <Link
                        href={`/contract?sale=${sale._id}`}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors inline-flex items-center gap-1.5"
                        title="Contrat de vente et garantie"
                      >
                        <FileSignature className="w-4 h-4 text-gold" />
                        <span className="text-[11px]">Contrat</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVOICE & RECEIPT PREVIEW MODAL */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedSale(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Top Format Selector */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Facture {selectedSale.invoiceNumber}
                </h2>
                <p className="text-xs text-neutral-400">
                  Émise le {new Date(selectedSale.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                <button
                  onClick={() => setPrintFormat('thermal')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    printFormat === 'thermal'
                      ? 'bg-gold text-ink shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Ticket 80mm
                </button>
                <button
                  onClick={() => setPrintFormat('a4')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    printFormat === 'a4'
                      ? 'bg-gold text-ink shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Facture A4
                </button>
              </div>
            </div>

            {/* Document Render Body */}
            <div className="flex-1 overflow-y-auto pr-1">
              {printFormat === 'thermal' ? (
                /* THERMAL TICKET FORMAT */
                <div className="max-w-xs mx-auto bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 font-mono text-xs text-neutral-300 space-y-3 shadow-inner">
                  <div className="text-center space-y-0.5 border-b border-dashed border-neutral-700 pb-3">
                    <p className="font-extrabold text-white text-sm">
                      {establishment?.name || 'Zaff'}
                    </p>
                    <p className="text-[10px] text-neutral-400">{establishment?.phone || '+225 ...'}</p>
                    <p className="text-[10px] text-neutral-400">{establishment?.address || 'Abidjan, Côte d’Ivoire'}</p>
                    <p className="text-[11px] text-gold-soft font-bold mt-1">
                      TICKET DE CAISSE
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      Réf: {selectedSale.invoiceNumber}
                    </p>
                  </div>

                  <div className="space-y-1.5 border-b border-dashed border-neutral-700 pb-3">
                    {selectedSale.items?.map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-[11px]">
                        <div>
                          <p className="font-semibold text-white">{it.productName}</p>
                          <p className="text-neutral-500">
                            {it.quantity} x {formatPrice(it.unitPrice)}
                          </p>
                        </div>
                        <span className="font-bold text-white">
                          {formatPrice(it.total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 text-xs border-b border-dashed border-neutral-700 pb-3">
                    {selectedSale.discount > 0 && (
                      <div className="flex justify-between text-neutral-400">
                        <span>Remise:</span>
                        <span>-{formatPrice(selectedSale.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-extrabold text-white pt-1">
                      <span>TOTAL TTC:</span>
                      <span className="text-gold-soft">{formatPrice(selectedSale.total)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400 text-[10px]">
                      <span>Règlement ({paymentLabel(selectedSale.paymentMethod)}):</span>
                      <span>{formatPrice(selectedSale.paidAmount || selectedSale.total)}</span>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-neutral-500 pt-1 space-y-0.5">
                    <p>Client: {selectedSale.customerId?.name || 'Client Comptant'}</p>
                    <p>Merci pour votre confiance !</p>
                    <p className="italic">Conservez ce ticket pour la garantie.</p>
                  </div>
                </div>
              ) : (
                /* A4 COMMERCIAL INVOICE FORMAT */
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-xs text-neutral-300 space-y-5">
                  <div className="flex justify-between items-start border-b border-neutral-800 pb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-white">{establishment?.name}</h3>
                      <p className="text-neutral-400">{establishment?.phone}</p>
                      <p className="text-neutral-400">{establishment?.email || 'contact@zaff.com'}</p>
                      <p className="text-neutral-400">{establishment?.address || 'Abidjan'}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold/10 text-gold border border-gold/30">
                        FACTURE OFFICIELLE
                      </span>
                      <p className="font-mono font-bold text-white text-sm mt-2">
                        {selectedSale.invoiceNumber}
                      </p>
                      <p className="text-neutral-400">
                        {new Date(selectedSale.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                      Facturé à
                    </span>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {selectedSale.customerId?.name || 'Client Comptant'}
                    </p>
                    {selectedSale.customerId?.phone && (
                      <p className="text-neutral-400">{selectedSale.customerId?.phone}</p>
                    )}
                  </div>

                  <table className="w-full text-left">
                    <thead className="border-b border-neutral-800 text-neutral-500 text-[11px]">
                      <tr>
                        <th className="py-2">Désignation</th>
                        <th className="py-2 text-center">Qté</th>
                        <th className="py-2 text-right">Prix Unitaire</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {selectedSale.items?.map((it: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2 font-medium text-white">{it.productName}</td>
                          <td className="py-2 text-center text-neutral-400">{it.quantity}</td>
                          <td className="py-2 text-right text-neutral-400">{formatPrice(it.unitPrice)}</td>
                          <td className="py-2 text-right font-bold text-white">{formatPrice(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t border-neutral-800 pt-3 flex justify-end">
                    <div className="w-60 space-y-1.5 text-right">
                      <div className="flex justify-between text-neutral-400">
                        <span>Sous-total:</span>
                        <span>{formatPrice(selectedSale.subtotal || selectedSale.total)}</span>
                      </div>
                      {selectedSale.discount > 0 && (
                        <div className="flex justify-between text-neutral-400">
                          <span>Remise:</span>
                          <span>-{formatPrice(selectedSale.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-extrabold text-gold-soft pt-1 border-t border-neutral-800">
                        <span>Net à Payer:</span>
                        <span>{formatPrice(selectedSale.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions footer */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-gold/20"
              >
                <Printer className="w-4 h-4" /> Imprimer Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
