'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BorderBeamProps {
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  className?: string;
}

/** Faisceau lumineux qui parcourt la bordure du parent (Magic UI « Border Beam ») — parent en `relative` */
export function BorderBeam({
  size = 80,
  duration = 6,
  colorFrom = '#f5d77f',
  colorTo = '#d4a017',
  borderWidth = 1.5,
  className,
}: BorderBeamProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={{ borderWidth, borderStyle: 'solid' }}
    >
      <motion.div
        className={cn('absolute aspect-square', className)}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
        }}
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: '100%' }}
        transition={{ repeat: Infinity, ease: 'linear', duration }}
      />
    </div>
  );
}
