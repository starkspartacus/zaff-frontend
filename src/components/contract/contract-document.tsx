'use client';

import React from 'react';
import { formatInternational } from '@/lib/geo';
import { warrantyVerifyUrl } from '@/lib/env';
import { QrCode } from '@/components/ui/qr-code';
import { CONDITION_LABELS, formatDate, formatMoney, type ContractBlock, type ContractItem, type ProductCondition, type RenderedContract } from '@/lib/contract';

/**
 * Contrat de vente et garantie, mis en page comme une feuille A4 (écran et impression).
 * Les informations inconnues restent en pointillés pour être complétées à la main.
 */
export function ContractDocument({ doc }: { doc: RenderedContract }) {
  const money = (n: number) => formatMoney(n, doc.shop.currency);
  const legal = doc.shop.legal;
  const city = doc.shop.address?.split(', ').slice(-2, -1)[0] || '';

  return (
    <article className="contract-paper mx-auto w-full max-w-[210mm] bg-white text-neutral-900 shadow-2xl print:shadow-none rounded-sm print:rounded-none px-6 py-8 sm:px-12 sm:py-12 print:p-0 text-[13px] leading-relaxed">
      {doc.sample && (
        <p className="mb-6 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800 print:hidden">
          Aperçu avec une vente fictive — le vrai contrat reprend la vente, le client et l&apos;appareil.
        </p>
      )}

      {/* En-tête */}
      <header className="text-center border-b-2 border-[#b8860b] pb-6">
        <p className="text-2xl sm:text-3xl font-black tracking-wide uppercase">{doc.shop.displayName}</p>
        {legal.legalForm && <p className="text-xs tracking-[0.4em] text-neutral-600 mt-1">{legal.legalForm.toUpperCase().split('').join(' ')}</p>}
        <h1 className="mt-5 text-lg sm:text-xl font-extrabold uppercase leading-snug text-[#7a5a00]">{doc.title}</h1>
        {doc.subtitle && <p className="mt-1 text-sm italic text-neutral-600">{doc.subtitle}</p>}
        {doc.countryLine && <p className="mt-3 text-xs font-bold uppercase tracking-wider">{doc.countryLine}</p>}
        {doc.lawReference && <p className="text-xs text-neutral-600">{doc.lawReference}</p>}
        <p className="mt-3 text-[11px] text-neutral-500">
          Document n° {doc.documentNumber} · Facture n° {doc.sale.invoiceNumber} du {formatDate(doc.sale.date)}
          {doc.version ? ` · Conditions v${doc.version}` : ''}
        </p>
      </header>

      <div className="mt-5 space-y-2 text-justify">
        <Blocks blocks={doc.intro} />
      </div>

      {/* Sommaire */}
      <section className="mt-6 rounded border border-neutral-300 p-4 break-inside-avoid">
        <p className="text-xs font-bold uppercase tracking-wider text-[#7a5a00] mb-2">Sommaire</p>
        <ol className="columns-1 sm:columns-2 print:columns-2 gap-6 text-[11px] text-neutral-700">
          {doc.articles.map((a) => (
            <li key={a.id} className="break-inside-avoid">
              Article {a.number} — {a.title}
            </li>
          ))}
        </ol>
      </section>

      {/* Articles */}
      <div className="mt-6 space-y-6">
        {doc.articles.map((a) => (
          <section key={a.id} className="space-y-2">
            <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-[#7a5a00] border-b border-neutral-200 pb-1 break-after-avoid">
              Article {a.number} — {a.title}
            </h2>
            {a.kind === 'seller' && <SellerBox doc={doc} />}
            {a.kind === 'customer' && <CustomerBox doc={doc} />}
            {a.kind === 'product' && <ProductsBox doc={doc} money={money} />}
            <div className="space-y-2 text-justify">
              <Blocks blocks={a.blocks} />
            </div>
          </section>
        ))}
      </div>

      {/* Signatures */}
      <section className="mt-10 break-inside-avoid">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-[#7a5a00] border-b border-neutral-200 pb-1">Signatures</h2>
        <p className="mt-3">
          Fait à <Fill value={city} width="10rem" />, le <Fill value={formatDate(doc.sale.date)} width="8rem" />, en deux exemplaires.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <SignBox title={`Pour ${doc.shop.displayName}`}>
            <Row label="Nom et qualité du représentant" value={legal.representative || doc.sale.sellerName} />
            <p className="text-[11px] text-neutral-600 mt-2">Signature et cachet :</p>
          </SignBox>
          <SignBox title="Le Client">
            <Row label="Nom et prénom" value={doc.customer?.name} />
            <p className="text-[11px] text-neutral-600 mt-2">Mention « Lu et approuvé » et signature :</p>
          </SignBox>
        </div>
      </section>

      {/* Fiche de garantie détachable */}
      {doc.warrantyCard &&
        doc.items.map((item, i) => (
          <section key={i} className="mt-10 break-before-page break-inside-avoid">
            <div className="border-t-2 border-dashed border-neutral-400 pt-1 text-center text-[10px] text-neutral-400 print:hidden">✂ à découper et à conserver</div>
            <div className="mt-4 rounded-lg border-2 border-[#b8860b] p-5">
              <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-3">
                <div>
                  <p className="text-lg font-black uppercase">{doc.shop.displayName}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#7a5a00]">Fiche de garantie</p>
                </div>
                <div className="text-right text-[11px] text-neutral-600">
                  <p>Facture n° {doc.sale.invoiceNumber}</p>
                  {doc.shop.phone && <p>{phone(doc.shop.phone)}</p>}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 print:grid-cols-2 gap-x-6 mt-3">
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-500 mb-1">Détails du produit</p>
                  <Row label="Produit" value={item.productName} />
                  <Row label="Marque" value={item.brand} />
                  <Row label="Modèle" value={item.model} />
                  <Row label="N° de série" value={item.serialNumber} mono />
                  <Row label="Date d'achat" value={formatDate(doc.sale.date)} />
                  <Row label="Prix" value={money(item.price)} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-500 mb-1">Garantie</p>
                  <Row label="Durée (mois)" value={String(item.warrantyMonths)} />
                  <Row label="Date de début" value={formatDate(item.warrantyStart)} />
                  <Row label="Date de fin" value={formatDate(item.warrantyEnd)} strong />
                  <Row label="Accessoires fournis" value={item.accessories} />
                  <Row label="Observations" value={null} />
                </div>
              </div>
              <VerifyBlock code={item.verifyCode} />
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="h-20 rounded border border-neutral-300 p-2 text-[11px] text-neutral-500">Cachet {doc.shop.displayName} :</div>
                <div className="h-20 rounded border border-neutral-300 p-2 text-[11px] text-neutral-500">Signature du Client :</div>
              </div>
            </div>
          </section>
        ))}
    </article>
  );
}

/** QR code de vérification : le client (ou un acheteur d'occasion) scanne et voit l'état de la garantie */
function VerifyBlock({ code }: { code: string | null }) {
  return (
    <div className="mt-4 flex items-center gap-4 rounded-lg bg-neutral-50 border border-neutral-200 p-3 break-inside-avoid print:bg-white">
      {code ? (
        <QrCode value={warrantyVerifyUrl(code)} size={96} className="shrink-0 bg-white p-1" />
      ) : (
        <div className="w-24 h-24 shrink-0 rounded border-2 border-dashed border-neutral-300 flex items-center justify-center text-center text-[9px] text-neutral-400 p-1">
          QR code de la vente
        </div>
      )}
      <div className="text-[11px] text-neutral-700 space-y-1">
        <p className="font-bold uppercase tracking-wider text-[#7a5a00]">Vérifier la garantie</p>
        <p>Scannez ce code avec l&apos;appareil photo d&apos;un téléphone : il affiche l&apos;appareil, la boutique et la date de fin de garantie, sans aucune donnée personnelle.</p>
        <p className="text-neutral-500">Code infalsifiable, propre à cet appareil et à cette vente.</p>
      </div>
    </div>
  );
}

function Blocks({ blocks }: { blocks: ContractBlock[] }) {
  // Les puces consécutives forment une liste
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (!list.length) return;
    out.push(
      <ul key={`l${k}`} className="list-disc pl-6 space-y-0.5">
        {list.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    );
    list = [];
  };
  blocks.forEach((b, i) => {
    if (b.type === 'li') list.push(b.text);
    else {
      flush(i);
      out.push(<p key={i}>{b.text}</p>);
    }
  });
  flush(blocks.length);
  return <>{out}</>;
}

const phone = (v?: string | null) => (v ? formatInternational(v) : null);
const capitalize = (v?: string | null) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : null);

/** Valeur, ou pointillés à compléter à la main */
function Fill({ value, width = '100%' }: { value?: string | null; width?: string }) {
  return value ? (
    <span className="font-semibold">{value}</span>
  ) : (
    <span className="inline-block border-b border-dotted border-neutral-500 align-bottom" style={{ width, minWidth: '4rem' }}>
      &nbsp;
    </span>
  );
}

function Row({ label, value, mono, strong }: { label: string; value?: string | null; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex gap-2 py-1 border-b border-neutral-100 last:border-0 break-inside-avoid">
      <span className="w-40 shrink-0 text-neutral-600">{label} :</span>
      <span className={`flex-1 min-w-0 break-words ${mono ? 'font-mono' : ''} ${strong ? 'font-bold' : ''}`}>
        <Fill value={value} />
      </span>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-neutral-300 break-inside-avoid">
      <p className="bg-neutral-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-700 print:bg-neutral-100">{title}</p>
      <div className="px-3 py-1">{children}</div>
    </div>
  );
}

function SignBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-neutral-300 p-3 min-h-[9rem]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">{title}</p>
      {children}
    </div>
  );
}

function SellerBox({ doc }: { doc: RenderedContract }) {
  const l = doc.shop.legal;
  return (
    <>
      <Box title="Le Vendeur">
        <Row label="Dénomination sociale" value={[l.legalName || doc.shop.name, l.legalForm].filter(Boolean).join(' ')} />
        <Row label="Activité" value={l.activity} />
        <Row label="Adresse" value={doc.shop.address} />
        <Row label="Téléphone" value={phone(doc.shop.phone)} />
        <Row label="E-mail" value={doc.shop.email} />
        <Row label="RCCM" value={l.rccm} />
        <Row label="N° compte contribuable" value={l.taxId} />
      </Box>
      <p>
        Ci-après dénommée « {doc.shop.displayName} » ou « le Vendeur ».
      </p>
    </>
  );
}

function CustomerBox({ doc }: { doc: RenderedContract }) {
  const c = doc.customer;
  return (
    <>
      <Box title="Le Client">
        <Row label="Nom et prénom / Raison sociale" value={c?.name} />
        <Row label="Adresse" value={c?.address} />
        <Row label="Téléphone" value={phone(c?.phone)} />
        <Row label="E-mail" value={c?.email} />
        <Row label="Pièce d'identité / Référence" value={null} />
      </Box>
      <p>Ci-après dénommé « le Client ».</p>
    </>
  );
}

function ConditionChecks({ value }: { value: ProductCondition }) {
  return (
    <span className="flex flex-wrap gap-x-4">
      {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((k) => (
        <span key={k} className={k === value ? 'font-bold' : 'text-neutral-500'}>
          {k === value ? '☒' : '☐'} {CONDITION_LABELS[k]}
        </span>
      ))}
    </span>
  );
}

function ProductsBox({ doc, money }: { doc: RenderedContract; money: (n: number) => string }) {
  return (
    <>
      <p>Le présent contrat concerne {doc.items.length > 1 ? 'les produits suivants' : 'le produit suivant'} :</p>
      {doc.items.map((item: ContractItem, i) => (
        <div key={i} className="space-y-2">
          <Box title={doc.items.length > 1 ? `Produit ${i + 1}` : 'Le produit'}>
            <Row label="Type de produit" value={capitalize(item.category)} />
            <Row label="Désignation" value={item.productName} />
            <Row label="Marque" value={item.brand} />
            <Row label="Modèle" value={[item.model, item.color].filter(Boolean).join(' · ') || null} />
            <Row label="Numéro de série" value={item.serialNumber} mono />
            <Row label="Référence commerciale" value={item.reference} />
            <div className="flex gap-2 py-1 border-b border-neutral-100">
              <span className="w-40 shrink-0 text-neutral-600">État lors de la vente :</span>
              <ConditionChecks value={item.condition} />
            </div>
            <Row label="Accessoires fournis" value={item.accessories} />
          </Box>
          <Box title="Conditions financières & garantie">
            <Row label="Prix de vente TTC" value={item.quantity > 1 ? `${item.quantity} × ${money(item.price)}` : money(item.price)} strong />
            <Row label="Date de vente" value={formatDate(doc.sale.date)} />
            <Row label="Début de garantie" value={formatDate(item.warrantyStart)} />
            <Row label="Durée de garantie" value={item.warrantyMonths > 0 ? `${item.warrantyMonths} mois` : 'Sans garantie commerciale'} />
            <Row label="Expiration de garantie" value={item.warrantyEnd ? formatDate(item.warrantyEnd) : '—'} strong />
          </Box>
        </div>
      ))}
      {(doc.items.length > 1 || doc.sale.discount > 0 || doc.sale.creditNoteAmount > 0) && (
        <Box title="Total de la vente">
          {doc.sale.discount > 0 && <Row label="Remise" value={`− ${money(doc.sale.discount)}`} />}
          <Row label="Total TTC" value={money(doc.sale.total)} strong />
          {doc.sale.creditNoteAmount > 0 && <Row label="Dont payé par avoir" value={money(doc.sale.creditNoteAmount)} />}
          <Row label="Mode de paiement" value={doc.sale.paymentLabel} />
        </Box>
      )}
    </>
  );
}
