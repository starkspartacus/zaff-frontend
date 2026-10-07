import React from 'react';
import { cn } from '@/lib/utils';

/** Texte traversé par un reflet (Magic UI « Animated Shiny Text ») */
export function AnimatedShinyText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block bg-clip-text text-transparent [background-size:200%_100%] animate-[shiny-text_2.5s_linear_infinite]',
        'bg-[linear-gradient(110deg,#a3a3a3_0%,#a3a3a3_35%,#fff7d6_50%,#a3a3a3_65%,#a3a3a3_100%)]',
        className
      )}
    >
      {children}
    </span>
  );
}
