'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchOption {
  value: string;
  label: string;
  /** Texte secondaire (indicatif, devise…) */
  hint?: string;
  /** Emoji / icône à gauche (drapeau) */
  prefix?: string;
  /** Mots supplémentaires pour la recherche */
  keywords?: string;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Liste déroulante avec recherche, pensée pour le téléphone : grande zone tactile, plein écran sur mobile,
 * recherche sans accents (« cote » trouve « Côte d'Ivoire »), sélection au clavier.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Rechercher…',
  title,
  invalid,
  disabled,
  compact,
  renderValue,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder: string;
  searchPlaceholder?: string;
  title?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Affichage réduit (sélecteur d'indicatif) */
  compact?: boolean;
  renderValue?: (opt: SearchOption) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) => normalize(`${o.label} ${o.hint || ''} ${o.keywords || ''} ${o.value}`).includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setActive(0);
          setOpen(true);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-xl bg-neutral-900 border text-left text-white transition-colors disabled:opacity-50',
          compact ? 'h-12 px-3 shrink-0' : 'w-full h-12 px-3.5',
          invalid ? 'border-red-500/60' : 'border-neutral-800 hover:border-neutral-600 focus:border-gold focus:outline-none'
        )}
      >
        {selected ? (
          renderValue ? (
            renderValue(selected)
          ) : (
            <span className="flex items-center gap-2 min-w-0 flex-1">
              {selected.prefix && <span className="text-lg leading-none">{selected.prefix}</span>}
              <span className="truncate text-sm">{selected.label}</span>
              {selected.hint && <span className="text-xs text-neutral-500 shrink-0">{selected.hint}</span>}
            </span>
          )
        ) : (
          <span className="flex-1 text-sm text-neutral-500">{placeholder}</span>
        )}
        <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-label={title || placeholder}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md max-h-[85vh] sm:max-h-[70vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-neutral-950 border border-neutral-800 shadow-2xl"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="text-sm font-bold text-white">{title || placeholder}</p>
                <button type="button" onClick={() => setOpen(false)} className="p-1.5 text-neutral-500 hover:text-white" aria-label="Fermer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, filtered.length - 1)));
                      if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
                      if (e.key === 'Enter' && filtered[active]) (e.preventDefault(), choose(filtered[active].value));
                    }}
                    placeholder={searchPlaceholder}
                    role="combobox"
                    aria-controls={listId}
                    aria-expanded
                    className="w-full h-11 pl-9 pr-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
              <ul id={listId} role="listbox" className="flex-1 overflow-y-auto px-2 pb-3 overscroll-contain">
                {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-500">Aucun résultat</li>}
                {filtered.map((o, i) => {
                  const isSelected = o.value === value;
                  return (
                    <li key={o.value} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => choose(o.value)}
                        onMouseEnter={() => setActive(i)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm',
                          i === active ? 'bg-neutral-900' : '',
                          isSelected ? 'text-gold-soft' : 'text-white'
                        )}
                      >
                        {o.prefix && <span className="text-xl leading-none w-7 text-center">{o.prefix}</span>}
                        <span className="flex-1 truncate">{o.label}</span>
                        {o.hint && <span className="text-xs text-neutral-500 shrink-0">{o.hint}</span>}
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
