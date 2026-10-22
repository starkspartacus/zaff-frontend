'use client';

import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { warrantyVerifyUrl } from '@/lib/env';
import { openPrintWindow } from '@/components/labels/print-labels';

/** Ticket de caisse tel que renvoyé par `GET /sales/:id/receipt` (montants calculés par le serveur) */
export interface SaleReceipt {
  shop: { name: string; legalName: string | null; address: string | null; phone: string | null; rccm: string | null; taxId: string | null; currency: string };
  sale: {
    id: string;
    invoiceNumber: number;
    date: string | null;
    sellerName: string | null;
    saleType: 'purchase' | 'reseller';
    customer: { name: string | null; phone: string | null; isReseller: boolean } | null;
    subtotal: number;
    discount: number;
    total: number;
    creditNoteCode: string | null;
    creditNoteAmount: number;
    paymentMethod: string;
    paymentLabel: string;
    amountGiven: number | null;
    change: number;
    depositAmount: number;
    depositLabel: string | null;
    amountDue: number;
    returnedAmount: number;
  };
  items: Array<{ productName: string; serialNumber: string | null; quantity: number; unitPrice: number; total: number; warrantyEnd: string | null; verifyCode: string | null }>;
  policy: { returnWindowDays: number; exchangeWindowDays: number };
}

export type ReceiptWidth = 58 | 80;
export interface ReceiptSettings {
  width: ReceiptWidth;
  /** Ouvre l'impression du ticket dès que la vente est validée */
  auto: boolean;
  /** 2 = un ticket pour le client et un pour la boutique (ventes à crédit : signature) */
  copies: 1 | 2;
}

const KEY = 'zaff-receipt';
const DEFAULTS: ReceiptSettings = { width: 80, auto: false, copies: 1 };

/** Réglages propres à cet appareil (chaque caisse a son imprimante) */
export function loadReceiptSettings(): ReceiptSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return {
      width: raw?.width === 58 ? 58 : 80,
      auto: !!raw?.auto,
      copies: raw?.copies === 2 ? 2 : 1,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveReceiptSettings(s: ReceiptSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* navigation privée : réglage non mémorisé */
  }
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

/** Fenêtre d'impression du ticket, à ouvrir dès le clic (sinon le navigateur la bloque) */
export const openReceiptWindow = () => openPrintWindow('Préparation du ticket…', 'width=420,height=760');

/** HTML du ticket (sans script) : réutilisé pour l'aperçu et l'impression */
export async function receiptHtml(r: SaleReceipt, width: ReceiptWidth, copyLabel?: string) {
  const fmt = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)).replace(/ | /g, ' ')} ${r.shop.currency}`;
  const row = (l: string, v: string, cls = '') => `<div class="row ${cls}"><span>${l}</span><span>${v}</span></div>`;
  const s = r.sale;
  const date = s.date ? new Date(s.date) : new Date();
  const qrs = await Promise.all(
    r.items
      .filter((i) => i.verifyCode)
      .slice(0, 3)
      .map(async (i) => ({
        serial: i.serialNumber,
        svg: await QRCode.toString(warrantyVerifyUrl(i.verifyCode!), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }),
      })),
  );

  const items = r.items
    .map(
      (i) => `<div class="item"><div class="name">${esc(i.productName)}</div>
      ${i.serialNumber ? `<div class="small">N° série / IMEI : <b>${esc(i.serialNumber)}</b></div>` : ''}
      ${row(`${i.quantity} x ${fmt(i.unitPrice)}`, `<b>${fmt(i.total)}</b>`)}
      ${i.warrantyEnd ? `<div class="small">Garantie jusqu'au ${day(i.warrantyEnd)}</div>` : ''}</div>`,
    )
    .join('');

  const toPay = Math.max(0, s.total - s.creditNoteAmount);
  const pay =
    s.paymentMethod === 'credit'
      ? [
          s.depositAmount ? row(`Acompte (${esc(s.depositLabel || 'Espèces')})`, fmt(s.depositAmount)) : '',
          row('RESTE À PAYER', fmt(s.amountDue), 'big'),
        ].join('')
      : [
          row(`Payé (${esc(s.paymentLabel)})`, fmt(s.amountGiven ?? toPay)),
          s.change > 0 ? row('Monnaie rendue', fmt(s.change)) : '',
        ].join('');

  return `<div class="ticket">
  ${copyLabel ? `<div class="copy">${esc(copyLabel)}</div>` : ''}
  <div class="center">
    <div class="shop">${esc(r.shop.name)}</div>
    ${r.shop.legalName && r.shop.legalName !== r.shop.name ? `<div class="small">${esc(r.shop.legalName)}</div>` : ''}
    ${r.shop.address ? `<div class="small">${esc(r.shop.address)}</div>` : ''}
    ${r.shop.phone ? `<div class="small">Tél. ${esc(r.shop.phone)}</div>` : ''}
    ${r.shop.rccm || r.shop.taxId ? `<div class="small">${[r.shop.rccm && `RCCM ${esc(r.shop.rccm)}`, r.shop.taxId && `NCC ${esc(r.shop.taxId)}`].filter(Boolean).join(' · ')}</div>` : ''}
  </div>
  <div class="sep"></div>
  <div class="center title">TICKET DE CAISSE</div>
  ${row('Facture', `<b>N° ${s.invoiceNumber}</b>`)}
  ${row('Date', `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`)}
  ${s.sellerName ? row('Vendeur', esc(s.sellerName)) : ''}
  ${s.customer?.name ? row(s.customer.isReseller || s.saleType === 'reseller' ? 'Revendeur' : 'Client', esc(s.customer.name)) : ''}
  ${s.customer?.phone ? row('Tél. client', esc(s.customer.phone)) : ''}
  ${s.saleType === 'reseller' ? '<div class="small center">Vente au tarif revendeur</div>' : ''}
  <div class="sep"></div>
  ${items}
  <div class="sep"></div>
  ${s.discount ? row('Sous-total', fmt(s.subtotal)) + row('Remise', `- ${fmt(s.discount)}`) : ''}
  ${row('TOTAL', fmt(s.total), 'big')}
  ${s.creditNoteAmount ? row(`Avoir ${esc(s.creditNoteCode || '')}`, `- ${fmt(s.creditNoteAmount)}`) : ''}
  ${pay}
  ${s.returnedAmount ? row('Articles retournés', `- ${fmt(s.returnedAmount)}`) : ''}
  ${s.paymentMethod === 'credit' ? '<div class="sign">Signature du client :</div>' : ''}
  ${
    qrs.length
      ? `<div class="sep"></div><div class="center small">Vérifiez la garantie en scannant :</div>
        <div class="qrs">${qrs.map((q) => `<div class="qr">${q.svg}${qrs.length > 1 && q.serial ? `<div class="tiny">${esc(q.serial.slice(-6))}</div>` : ''}</div>`).join('')}</div>`
      : ''
  }
  <div class="sep"></div>
  <div class="center small">
    ${r.policy.returnWindowDays ? `Retour possible sous ${r.policy.returnWindowDays} jours, appareil complet et en bon état, sur présentation de ce ticket.<br>` : ''}
    Conservez ce ticket : il sert de preuve d'achat et de garantie.
  </div>
  <div class="center thanks">Merci de votre visite !</div>
</div>`;
}

const css = (width: ReceiptWidth) => {
  // Zone imprimable : 48 mm sur un rouleau de 58 mm, 72 mm sur un rouleau de 80 mm
  const w = width === 58 ? 48 : 72;
  const base = width === 58 ? 8.5 : 10;
  return `@page{size:${width}mm auto;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}
body{font-family:'Courier New',Courier,monospace;font-size:${base}pt;line-height:1.25;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ticket{width:${w}mm;margin:0 auto;padding:2mm 0 6mm}
.ticket+.ticket{page-break-before:always;break-before:page}
.center{text-align:center}.shop{font-size:${base + 4}pt;font-weight:700;font-family:Arial,Helvetica,sans-serif}
.title{font-weight:700;letter-spacing:1px;margin-bottom:1mm}
.small{font-size:${base - 1.5}pt}.tiny{font-size:${base - 2.5}pt;text-align:center}
.sep{border-top:1px dashed #000;margin:1.5mm 0}
.row{display:flex;justify-content:space-between;gap:2mm}.row span:last-child{text-align:right;white-space:nowrap}
.row.big{font-size:${base + 2}pt;font-weight:700;margin-top:.5mm}
.item{margin-bottom:1.2mm}.name{font-weight:700;font-family:Arial,Helvetica,sans-serif}
.qrs{display:flex;justify-content:center;gap:2mm;margin-top:1mm}.qr{width:${width === 58 ? 20 : 24}mm}.qr svg{width:100%;height:auto;display:block}
.sign{margin-top:3mm;padding-bottom:8mm;border-bottom:1px solid #000;font-size:${base - 1}pt}
.copy{text-align:center;font-weight:700;border:1px solid #000;margin-bottom:1.5mm;font-size:${base - 1}pt}
.thanks{font-weight:700;margin-top:1.5mm}
@media screen{body{background:#eee}.ticket{background:#fff;padding:3mm;margin:8px auto;box-shadow:0 1px 4px #0003}}`;
};

/**
 * Imprime le ticket thermique d'une vente (58 ou 80 mm). Ouvrir `win` dès le clic (`openReceiptWindow`) :
 * les données sont chargées ensuite, la fenêtre reste autorisée.
 */
export async function printReceipt(saleId: string, opts: Partial<ReceiptSettings> = {}, win?: Window) {
  const settings = { ...loadReceiptSettings(), ...opts };
  const w = win || openReceiptWindow();
  try {
    const r = (await api.get(`/sales/${saleId}/receipt`)) as unknown as SaleReceipt;
    const copies =
      settings.copies === 2 ? [await receiptHtml(r, settings.width, 'COPIE CLIENT'), await receiptHtml(r, settings.width, 'COPIE BOUTIQUE')] : [await receiptHtml(r, settings.width)];
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket N° ${r.sale.invoiceNumber}</title>
<style>${css(settings.width)}</style></head><body>${copies.join('')}
<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},300)}</script></body></html>`);
    w.document.close();
  } catch (e) {
    w.close();
    throw e;
  }
}

/** Facture A4 de la vente (mêmes données que le ticket), dans sa propre fenêtre : rien d'autre de l'écran n'est imprimé */
export async function printInvoiceA4(saleId: string, win?: Window) {
  const w = win || openPrintWindow('Préparation de la facture…');
  try {
    const r = (await api.get(`/sales/${saleId}/receipt`)) as unknown as SaleReceipt;
    const s = r.sale;
    const fmt = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)).replace(/ | /g, ' ')} ${r.shop.currency}`;
    const line = (l: string, v: string, b = false) => `<tr${b ? ' class="b"' : ''}><td>${l}</td><td>${v}</td></tr>`;
    const toPay = Math.max(0, s.total - s.creditNoteAmount);
    const rows = r.items
      .map(
        (i) => `<tr><td><b>${esc(i.productName)}</b>${i.serialNumber ? `<div class="sm">N° série / IMEI : ${esc(i.serialNumber)}</div>` : ''}${
          i.warrantyEnd ? `<div class="sm">Garantie jusqu'au ${day(i.warrantyEnd)}</div>` : ''
        }</td><td class="c">${i.quantity}</td><td class="r">${fmt(i.unitPrice)}</td><td class="r"><b>${fmt(i.total)}</b></td></tr>`,
      )
      .join('');
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Facture N° ${s.invoiceNumber}</title><style>
@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10.5pt;margin:0}
.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:4mm;margin-bottom:5mm}
h1{font-size:16pt;margin:0 0 1mm}.sm{font-size:8.5pt;color:#444}.tag{font-size:13pt;font-weight:700;text-align:right}
.box{border:1px solid #ccc;border-radius:2mm;padding:3mm;margin-bottom:5mm}
table.items{width:100%;border-collapse:collapse}table.items th{text-align:left;border-bottom:1px solid #111;padding:2mm 1mm;font-size:9pt}
table.items td{border-bottom:1px solid #ddd;padding:2mm 1mm;vertical-align:top}.c{text-align:center}.r{text-align:right;white-space:nowrap}
table.tot{margin-left:auto;margin-top:4mm;min-width:75mm}table.tot td{padding:1mm 2mm}table.tot td:last-child{text-align:right}
table.tot tr.b td{font-weight:700;font-size:12pt;border-top:1px solid #111}.foot{margin-top:10mm;font-size:8.5pt;color:#444}
</style></head><body>
<div class="head"><div><h1>${esc(r.shop.legalName || r.shop.name)}</h1>
${r.shop.address ? `<div class="sm">${esc(r.shop.address)}</div>` : ''}${r.shop.phone ? `<div class="sm">Tél. ${esc(r.shop.phone)}</div>` : ''}
${r.shop.rccm ? `<div class="sm">RCCM ${esc(r.shop.rccm)}</div>` : ''}${r.shop.taxId ? `<div class="sm">N° contribuable ${esc(r.shop.taxId)}</div>` : ''}</div>
<div><div class="tag">FACTURE N° ${s.invoiceNumber}</div><div class="sm" style="text-align:right">${day(s.date)}${s.sellerName ? `<br>Vendeur : ${esc(s.sellerName)}` : ''}</div></div></div>
<div class="box"><div class="sm">Facturé à</div><b>${esc(s.customer?.name || 'Client comptant')}</b>${s.customer?.phone ? `<div class="sm">${esc(s.customer.phone)}</div>` : ''}
${s.saleType === 'reseller' ? '<div class="sm">Revendeur — tarif revendeur</div>' : ''}</div>
<table class="items"><thead><tr><th>Désignation</th><th class="c">Qté</th><th class="r">Prix unitaire</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
<table class="tot">${line('Sous-total', fmt(s.subtotal))}${s.discount ? line('Remise', `- ${fmt(s.discount)}`) : ''}${line('Net à payer', fmt(s.total), true)}
${s.creditNoteAmount ? line(`Avoir ${esc(s.creditNoteCode || '')}`, `- ${fmt(s.creditNoteAmount)}`) : ''}
${s.paymentMethod === 'credit' ? `${s.depositAmount ? line(`Acompte (${esc(s.depositLabel || 'Espèces')})`, fmt(s.depositAmount)) : ''}${line('Reste à payer', fmt(s.amountDue), true)}` : line(`Payé (${esc(s.paymentLabel)})`, fmt(toPay))}
${s.returnedAmount ? line('Articles retournés', `- ${fmt(s.returnedAmount)}`) : ''}</table>
<div class="foot">${r.policy.returnWindowDays ? `Retour possible sous ${r.policy.returnWindowDays} jours, appareil complet et en bon état. ` : ''}Les conditions de garantie figurent sur le contrat de vente remis avec l'appareil.</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},300)}</script></body></html>`);
    w.document.close();
  } catch (e) {
    w.close();
    throw e;
  }
}
