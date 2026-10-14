'use client';

import React, { useState } from 'react';
import { Copy, Mail, MessageCircle, Printer } from 'lucide-react';
import { useClosingReport } from '@/lib/queries';

/** Rapport de clôture : envoi WhatsApp, copie, impression, état de l'e-mail envoyé au patron */
export function ClosingReportActions({ closingId }: { closingId: string }) {
  const { data: report, isLoading, isError } = useClosingReport(closingId);
  const [copied, setCopied] = useState(false);

  if (isLoading) return <p className="text-xs text-neutral-500">Préparation du rapport…</p>;
  if (isError || !report) return <p className="text-xs text-red-400">Rapport indisponible pour le moment.</p>;

  const phone = (report.ownerPhone || '').replace(/\D/g, '');
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(report.text)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers refusé */
    }
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${report.code}</title></head><body>${report.html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-2 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Rapport {report.code}</p>
      <div className="grid grid-cols-3 gap-2">
        <a href={wa} target="_blank" rel="noreferrer" className="h-11 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
        <button onClick={copy} className="h-11 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
          <Copy className="w-4 h-4" /> {copied ? 'Copié !' : 'Copier'}
        </button>
        <button onClick={print} className="h-11 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
          <Printer className="w-4 h-4" /> Imprimer
        </button>
      </div>
      <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
        <Mail className="w-3.5 h-3.5" />
        {report.emailedAt
          ? `Envoyé par e-mail au patron (${report.emailedTo.join(', ')})`
          : report.mailEnabled
            ? 'Envoi par e-mail au patron en cours…'
            : "Envoi par e-mail non configuré : utilisez WhatsApp."}
      </p>
    </div>
  );
}

/** Ne charge le rapport qu'à l'ouverture du volet */
export function ReportOnOpen({ closingId }: { closingId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-1">
      <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-gold-soft">
        {open ? 'Masquer le rapport' : 'Rapport (WhatsApp, impression)'}
      </button>
      {open && (
        <div className="pt-2">
          <ClosingReportActions closingId={closingId} />
        </div>
      )}
    </div>
  );
}
