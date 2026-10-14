'use client';

import { QrCode } from 'lucide-react';
import { CodeLabelsPanel } from '@/components/labels/code-labels-panel';

export default function LabelsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <QrCode className="w-6 h-6 text-gold" /> Étiquettes QR des appareils
        </h1>
        <p className="text-sm text-neutral-400">Générez et imprimez des codes uniques pour les appareils livrés sans N° de série.</p>
      </div>
      <CodeLabelsPanel />
    </div>
  );
}
