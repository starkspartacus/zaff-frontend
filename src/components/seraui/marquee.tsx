'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps {
  children: React.ReactNode;
  pauseOnHover?: boolean;
  className?: string;
}

export function Marquee({ children, pauseOnHover = true, className }: MarqueeProps) {
  return (
    <div className={cn('flex overflow-hidden select-none gap-4 group', className)}>
      <div
        className={cn(
          'flex shrink-0 justify-around gap-4 min-w-full animate-marquee',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{
          animation: 'marquee 25s linear infinite',
        }}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          'flex shrink-0 justify-around gap-4 min-w-full animate-marquee',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{
          animation: 'marquee 25s linear infinite',
        }}
      >
        {children}
      </div>
    </div>
  );
}
