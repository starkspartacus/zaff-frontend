'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Liste animée : chaque nouvel élément arrive en douceur en tête (Magic UI « Animated List ») */
export function AnimatedList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  );
}

export function AnimatedListItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      layout
      initial={{ scale: 0.92, opacity: 0, y: -12 }}
      animate={{ scale: 1, opacity: 1, y: 0, originY: 0 }}
      exit={{ scale: 0.92, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
