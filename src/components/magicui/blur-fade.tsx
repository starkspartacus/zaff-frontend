'use client';

import React from 'react';
import { motion } from 'framer-motion';

/** Apparition avec flou (Magic UI « Blur Fade ») */
export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.35,
  yOffset = 8,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay: 0.04 + delay, duration, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
