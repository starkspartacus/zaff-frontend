'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  shimmerColor?: string;
  className?: string;
}

export function ShimmerButton({
  children,
  shimmerColor = 'rgba(255, 255, 255, 0.25)',
  className,
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      className={cn(
        'relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm text-white bg-zinc-900 border border-zinc-700/80 hover:border-amber-500/60 transition-all duration-300 active:scale-95 group',
        className,
      )}
      {...props}
    >
      <span
        className="absolute inset-0 w-full h-full -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
      />
      {children}
    </button>
  );
}
