'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSaleContract, whatsappLink } from '@/lib/contract';
import { errorMessage } from '@/lib/types';
import { ContractDocument } from '@/components/contract/contract-document';

/**
 * Contrat de vente et garantie d'une vente (`/contract?sale=<id>`), hors du menu de l'application
 * pour s'imprimer proprement (A4) ou s'enregistrer en PDF depuis le téléphone.
 */
export default function ContractPage() {
  return (
    <Suspense fallback={null}>
      <ContractView />
    </Suspense>
  );
}

function ContractView() {
  const saleId = useSearchParams().get('sale');
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const { data: doc, isLoading, error } = useSaleContract(token ? saleId : null);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  const back = () => (window.history.length > 1 ? router.back() : router.push('/app'));

  return (
    <div className="min-h-screen bg-neutral-800 print:bg-white">
      <style>{`@page { size: A4; margin: 14mm 12mm; } @media print { html, body { background: #fff !important; } }`}</style>

      {/* Barre d'actions (non imprimée) */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur border-b border-neutral-800 print:hidden">
        <div className="max-w-[210mm] mx-auto px-3 py-2.5 flex items-center gap-2">
          <button onClick={back} className="h-11 px-3 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-200 text-sm font-semibold flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <p className="flex-1 min-w-0 truncate text-xs text-neutral-400 text-center">
            {doc ? `Contrat · facture n° ${doc.sale.invoiceNumber}` : 'Contrat de vente et garantie'}
          </p>
          {doc && (
            <>
              <a
                href={whatsappLink(doc)}
                target="_blank"
                rel="noreferrer"
                className="h-11 px-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5"
                aria-label="Envoyer au client par WhatsApp"
              >
                <MessageCircle className="w-4 h-4" /> <span className="hidden sm:inline">WhatsApp</span>
              </a>
              <button
                onClick={() => window.print()}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#b8860b] text-black text-sm font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Imprimer / PDF
              </button>
            </>
          )}
        </div>
      </div>

      <main className="px-2 py-4 sm:py-8 print:p-0">
        {!saleId && <Message text="Aucune vente indiquée." />}
        {(isLoading || authLoading) && saleId && <Message text="Préparation du contrat…" />}
        {error && <Message text={errorMessage(error)} />}
        {doc && <ContractDocument doc={doc} />}
      </main>
    </div>
  );
}

function Message({ text }: { text: string }) {
  return <p className="max-w-md mx-auto mt-16 rounded-2xl bg-neutral-900 border border-neutral-700 p-6 text-center text-sm text-neutral-300">{text}</p>;
}
