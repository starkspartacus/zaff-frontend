'use client';

import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatAsYouType, isPhoneValid, useCountries, type CountryInfo } from '@/lib/geo';
import { SearchSelect, type SearchOption } from './search-select';
import { cn } from '@/lib/utils';

const countryOption = (c: CountryInfo): SearchOption => ({
  value: c.code,
  label: c.name,
  hint: c.dialCode,
  prefix: c.flag,
  keywords: `${c.currency.code} ${c.currency.symbol}`,
});

/** Choix du pays (drapeau, nom, indicatif) */
export function CountrySelect({ value, onChange, invalid }: { value: string | null; onChange: (code: string) => void; invalid?: boolean }) {
  const { data: countries = [], isLoading } = useCountries();
  const options = useMemo(() => countries.map(countryOption), [countries]);
  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={options}
      disabled={isLoading}
      invalid={invalid}
      placeholder={isLoading ? 'Chargement des pays…' : 'Choisissez le pays'}
      searchPlaceholder="Nom du pays ou indicatif (+225)"
      title="Pays"
    />
  );
}

/**
 * Téléphone : l'indicatif vient du pays choisi (il s'ajoute tout seul), le numéro est mis en forme
 * pendant la saisie et vérifié pour ce pays (Côte d'Ivoire : 10 chiffres).
 */
export function PhoneInput({
  country,
  onCountryChange,
  value,
  onChange,
  invalid,
  id,
  lockCountry,
  autoFocus,
}: {
  country: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChange: (national: string) => void;
  invalid?: boolean;
  id?: string;
  lockCountry?: boolean;
  autoFocus?: boolean;
}) {
  const { data: countries = [] } = useCountries();
  const info = countries.find((c) => c.code === country);
  const options = useMemo(() => countries.map(countryOption), [countries]);
  const valid = value.length > 0 && isPhoneValid(value, country);

  return (
    <div className="flex gap-2">
      <SearchSelect
        compact
        value={country}
        onChange={onCountryChange}
        options={options}
        disabled={lockCountry}
        title="Indicatif du pays"
        placeholder="Pays"
        searchPlaceholder="Nom du pays ou indicatif"
        renderValue={(o) => (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="text-lg leading-none">{o.prefix}</span>
            <span className="font-semibold">{o.hint}</span>
          </span>
        )}
      />
      <div className="relative flex-1">
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(formatAsYouType(e.target.value.replace(/[^\d\s]/g, ''), country))}
          placeholder={info?.example || 'Numéro de téléphone'}
          aria-invalid={invalid}
          className={cn(
            'w-full h-12 pl-3.5 pr-10 rounded-xl bg-neutral-900 border text-base font-semibold tracking-wide text-white placeholder:text-neutral-600 placeholder:font-normal focus:outline-none',
            invalid ? 'border-red-500/60' : 'border-neutral-800 focus:border-gold'
          )}
        />
        {valid && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" aria-label="Numéro valide" />}
      </div>
    </div>
  );
}

/** Communes en grosses pastilles faciles à toucher */
export function CommunePicker({ communes, value, onChange, invalid }: { communes: string[]; value: string | null; onChange: (c: string) => void; invalid?: boolean }) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl p-1', invalid && 'ring-1 ring-red-500/60')}>
      {communes.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          className={cn(
            'h-11 px-2 rounded-xl border text-sm font-medium transition-colors',
            value === c ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function FieldLabel({ htmlFor, children, optional }: { htmlFor?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-neutral-300 mb-1.5">
      {children} {optional && <span className="font-normal text-neutral-500">(facultatif)</span>}
    </label>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-red-400 mt-1.5">{msg}</p> : null;
}
