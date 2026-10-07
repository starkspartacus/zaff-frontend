'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NumberTickerProps {
  value: number;
  /** Texte ajouté après le nombre (ex. « F CFA ») */
  suffix?: string;
  decimalPlaces?: number;
  className?: string;
}

/**
 * Nombre animé par ressort (Magic UI « Number Ticker »). Écrit directement dans le DOM :
 * aucun re-rendu React par image, même quand la valeur change en temps réel.
 */
export function NumberTicker({ value, suffix = '', decimalPlaces = 0, className }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 60, stiffness: 120 });
  const inView = useInView(ref, { once: true, margin: '0px' });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [motionValue, inView, value]);

  useEffect(
    () =>
      spring.on('change', (latest) => {
        if (!ref.current) return;
        const n = Intl.NumberFormat('fr-FR', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }).format(Number(latest.toFixed(decimalPlaces)));
        ref.current.textContent = suffix ? `${n} ${suffix}` : n;
      }),
    [spring, decimalPlaces, suffix]
  );

  return (
    <span ref={ref} className={cn('inline-block tabular-nums', className)}>
      {suffix ? `0 ${suffix}` : '0'}
    </span>
  );
}
