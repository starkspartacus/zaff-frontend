'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'gold' | 'dark' | 'outline';
  glowColor?: string;
  className?: string;
}

export function GlowButton({
  children,
  variant = 'gold',
  glowColor = 'rgba(234, 179, 8, 0.4)',
  className,
  ...props
}: GlowButtonProps) {
  return (
    <button
      className={cn(
        'relative group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variant === 'gold' &&
          'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02]',
        variant === 'dark' &&
          'bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-800 hover:border-zinc-700 hover:scale-[1.02]',
        variant === 'outline' &&
          'border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400',
        className,
      )}
      {...props}
    >
      {/* Effet halo rayonnant */} 
      <span
        className="absolute -inset-0.5 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10"
        style={{ backgroundColor: glowColor }}
      />
      {children}
    </button>
  );
}
