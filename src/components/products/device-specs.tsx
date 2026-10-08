'use client';

import React from 'react';
import { Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Fiche technique officielle d'un appareil (catalogue ZAFF) */
export function DeviceSpecs({ specs, className, title = 'Fiche technique' }: { specs?: { label: string; value: string }[]; className?: string; title?: string }) {
  if (!specs?.length) return null;
  return (
    <div className={cn('rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden', className)}>
      <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 border-b border-neutral-800">
        <Cpu className="w-3.5 h-3.5 text-gold" /> {title}
      </p>
      <dl className="divide-y divide-neutral-800 text-xs">
        {specs.map((s) => (
          <div key={s.label} className="flex gap-3 px-3 py-2">
            <dt className="w-28 shrink-0 text-neutral-500">{s.label}</dt>
            <dd className="text-white font-medium">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
