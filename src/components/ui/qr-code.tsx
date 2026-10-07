'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR code vectoriel (net à l'impression), généré dans le navigateur */
export function QrCode({ value, size = 112, className }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label="QR code"
      className={className}
      style={{ width: size, height: size }}
      // SVG produit par la bibliothèque qrcode à partir de notre propre lien
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
