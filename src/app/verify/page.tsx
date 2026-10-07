'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock, Phone, ShieldCheck, ShieldOff, Store, Wrench, XCircle } from 'lucide-react';
import { formatDate, useWarrantyCheck, type WarrantyCheck } from '@/lib/contract';
import { formatInternational } from '@/lib/geo';
import { errorMessage } from '@/lib/types';
import { Logo } from '@/components/ui/logo';
import { BorderBeam } from '@/components/magicui/border-beam';

/**
 * Page ouverte par le QR code de la fiche de garantie (`/verify?c=…`) : publique, sans connexion.
 * Montre l'appareil, la boutique et l'état de la garantie — jamais le client ni le prix.
 */
export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}

function Verify() {
  const code = useSearchParams().get('c');
  const { data, isLoading, error } = useWarrantyCheck(code);

  return (
    <div className="min-h-screen bg-black px-4 py-8 flex flex-col items-center">
      <Logo size="md" className="mb-6" />
      <div className="w-full max-w-md">
        {!code && <Notice tone="error" icon={XCircle} title="Lien incomplet" text="Scannez à nouveau le QR code de la fiche de garantie." />}
        {code && isLoading && (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-10 text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-gold border-t-transparent animate-spin" />
            <p className="text-sm text-neutral-400 mt-4">Vérification de la garantie…</p>
          </div>
        )}
        {error && <Notice tone="error" icon={ShieldOff} title="Garantie non confirmée" text={errorMessage(error)} />}
        {data && <Result r={data} />}
      </div>
      <p className="mt-8 text-[11px] text-neutral-600 text-center max-w-xs">
        Vérification fournie par ZAFF, le logiciel de caisse de la boutique. Aucune donnée personnelle n&apos;est affichée.
      </p>
    </div>
  );
}

const STATUS = {
  active: { icon: ShieldCheck, title: 'Garantie active', color: 'emerald' },
  expired: { icon: Clock, title: 'Garantie terminée', color: 'amber' },
  none: { icon: ShieldOff, title: 'Vendu sans garantie', color: 'amber' },
  returned: { icon: AlertTriangle, title: 'Appareil rapporté à la boutique', color: 'red' },
} as const;

function Result({ r }: { r: WarrantyCheck }) {
  const s = STATUS[r.status];
  const tone =
    s.color === 'emerald'
      ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400'
      : s.color === 'amber'
        ? 'border-amber-500/40 bg-amber-500/5 text-amber-400'
        : 'border-red-500/40 bg-red-500/5 text-red-400';
  const subtitle =
    r.status === 'active'
      ? `Jusqu'au ${formatDate(r.warrantyEnd)} · encore ${r.daysLeft} jour${r.daysLeft > 1 ? 's' : ''}`
      : r.status === 'expired'
        ? `Terminée le ${formatDate(r.warrantyEnd)}. Une réparation reste possible sur devis.`
        : r.status === 'none'
          ? 'Cet appareil a été vendu sans garantie commerciale.'
          : "Cet appareil a été repris par la boutique : cette garantie n'est plus valable.";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className={`relative overflow-hidden rounded-3xl border p-6 text-center ${tone}`}>
        {r.status === 'active' && <BorderBeam size={120} duration={6} colorFrom="#34d399" colorTo="#d4a017" />}
        <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
          <s.icon className="w-14 h-14 mx-auto" />
        </motion.div>
        <p className="text-2xl font-black text-white mt-3">{s.title}</p>
        <p className="text-sm text-neutral-300 mt-1">{subtitle}</p>
        {r.device === 'in_repair' && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 px-3 py-1 text-xs text-sky-300">
            <Wrench className="w-3.5 h-3.5" /> Actuellement en réparation à la boutique
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gold">Appareil</p>
        <p className="text-lg font-bold text-white">{r.product.brand && !r.product.name.toLowerCase().startsWith(r.product.brand.toLowerCase()) ? `${r.product.brand} ${r.product.name}` : r.product.name}</p>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          {r.product.model && <Item label="Version" value={r.product.model} />}
          {r.product.color && <Item label="Couleur" value={r.product.color} />}
          {r.product.serialMasked && <Item label="N° de série" value={r.product.serialMasked} mono />}
          <Item label="Acheté le" value={formatDate(r.purchaseDate)} />
          <Item label="Garantie" value={r.warrantyMonths > 0 ? `${r.warrantyMonths} mois` : 'Aucune'} />
          <Item label="Facture" value={`n° ${r.invoiceNumber}`} />
        </dl>
        <p className="text-[11px] text-neutral-500 flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />
          Comparez le N° de série avec celui de l&apos;appareil (Réglages → Informations, ou *#06#).
        </p>
      </div>

      <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
          <Store className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{r.shop.name}</p>
          {r.shop.city && <p className="text-xs text-neutral-500 truncate">{r.shop.city}</p>}
        </div>
        {r.shop.phone && (
          <a href={`tel:${r.shop.phone}`} className="h-11 px-4 rounded-2xl bg-gold text-ink text-sm font-bold flex items-center gap-1.5 shrink-0">
            <Phone className="w-4 h-4" /> <span className="hidden min-[380px]:inline">{formatInternational(r.shop.phone)}</span>
          </a>
        )}
      </div>
    </motion.div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`text-white text-right ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </>
  );
}

function Notice({ tone, icon: Icon, title, text }: { tone: 'error'; icon: React.ElementType; title: string; text: string }) {
  return (
    <div className={`rounded-3xl border p-6 text-center ${tone === 'error' ? 'border-red-500/40 bg-red-500/5' : ''}`}>
      <Icon className="w-12 h-12 mx-auto text-red-400" />
      <p className="text-xl font-black text-white mt-3">{title}</p>
      <p className="text-sm text-neutral-400 mt-1">{text}</p>
      <Link href="/" className="inline-block mt-4 text-xs text-gold hover:underline">
        Découvrir ZAFF
      </Link>
    </div>
  );
}
