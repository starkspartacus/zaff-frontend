'use client';

import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export type LabelFormat = 'a4' | 'thermal';

export const LABEL_FORMATS: Record<LabelFormat, { label: string; hint: string }> = {
  thermal: { label: 'Rouleau thermique 50 × 30 mm', hint: 'Une étiquette par page (imprimante d’étiquettes)' },
  a4: { label: 'Planche A4 (3 × 8)', hint: 'Étiquettes autocollantes 70 × 37 mm' },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Code-barres Code 128 en SVG (lisible par toutes les douchettes) */
function barcodeSvg(code: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, code, { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 1.6 });
  svg.setAttribute('preserveAspectRatio', 'none');
  return svg.outerHTML;
}

/** À appeler dès le clic (avant toute attente réseau), sinon le navigateur bloque la fenêtre */
export function openPrintWindow(): Window {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) throw new Error('Autorisez l’ouverture des fenêtres pour imprimer les étiquettes.');
  w.document.write('<p style="font-family:system-ui;padding:24px">Préparation des étiquettes…</p>');
  return w;
}

/**
 * Ouvre la fenêtre d'impression : QR code (le code lui-même, lu aussi par l'appareil photo du téléphone) +
 * code-barres + code en clair, nom de la boutique et du modèle prévu.
 */
export async function printLabels(
  opts: { codes: string[]; format: LabelFormat; shop: string; productName?: string | null; category?: string },
  win?: Window,
) {
  const w = win || openPrintWindow();

  const labels = await Promise.all(
    opts.codes.map(async (code) => {
      const qr = await QRCode.toString(code, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
      return `<div class="lbl"><div class="qr">${qr}</div><div class="side">
        <div class="shop">${esc(opts.shop)}</div>
        <div class="name">${esc(opts.productName || opts.category || '')}</div>
        <div class="bc">${barcodeSvg(code)}</div>
        <div class="code">${esc(code)}</div></div></div>`;
    }),
  );

  const thermal = opts.format === 'thermal';
  const css = thermal
    ? `@page{size:50mm 30mm;margin:0}body{margin:0}.lbl{width:50mm;height:30mm;padding:1.5mm;page-break-after:always;break-after:page}
       .qr{width:19mm;height:19mm}.side{width:26mm}`
    : `@page{size:A4;margin:10mm 0 0 0}body{margin:0}.sheet{display:grid;grid-template-columns:repeat(3,70mm);grid-auto-rows:37mm}
       .lbl{width:70mm;height:37mm;padding:3mm}.qr{width:26mm;height:26mm}.side{width:36mm}`;

  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Étiquettes ${esc(opts.codes[0] || '')}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff}
.lbl{display:flex;gap:1.5mm;align-items:center;overflow:hidden}.qr svg{width:100%;height:100%}
.side{display:flex;flex-direction:column;justify-content:center;min-width:0}
.shop{font-size:6pt;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.name{font-size:6pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.5mm}
.bc svg{width:100%;height:7mm;display:block}.code{font-family:'Courier New',monospace;font-size:7.5pt;font-weight:700;letter-spacing:.2px;margin-top:.5mm}
${css}</style></head><body><div class="sheet">${labels.join('')}</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},250)}</script></body></html>`);
  w.document.close();
}
