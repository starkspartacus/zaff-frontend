'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { cn } from '@/lib/utils';

/** Bascule clair / sombre (mémorisée sur l'appareil) */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const light = theme === 'light';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? 'Passer en mode sombre' : 'Passer en mode clair'}
      title={light ? 'Mode sombre' : 'Mode clair'}
      className={cn(
        'relative w-10 h-10 rounded-xl border border-neutral-800 bg-neutral-900 flex items-center justify-center overflow-hidden hover:border-gold/50 transition-colors',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, rotate: -60, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -14, rotate: 60, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {light ? <Moon className="w-4 h-4 text-neutral-300" /> : <Sun className="w-4 h-4 text-gold" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
