'use client';

import { useQuery } from '@tanstack/react-query';
import { AsYouType, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { api } from '@/lib/api';

export interface CountryInfo {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  currency: { code: string; symbol: string; name: string };
  hasCities: boolean;
  example: string | null;
}

export interface CityInfo {
  name: string;
  communes?: string[];
  communeRequired?: boolean;
}

export const DEFAULT_COUNTRY = 'CI';
const LAST_COUNTRY_KEY = 'zaff-last-country';

/** Pays utilisé la dernière fois sur cet appareil (sinon Côte d'Ivoire) */
export function lastCountry(): string {
  try {
    return localStorage.getItem(LAST_COUNTRY_KEY) || DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}
export function rememberCountry(code: string) {
  try {
    localStorage.setItem(LAST_COUNTRY_KEY, code);
  } catch {
    // préférence facultative
  }
}

// Données statiques côté serveur : chargées une fois, gardées en cache
export const useCountries = () =>
  useQuery({
    queryKey: ['geo', 'countries'],
    queryFn: () => api.get('/global/geo/countries') as unknown as Promise<CountryInfo[]>,
    staleTime: Infinity,
    gcTime: Infinity,
  });

export const useCities = (country?: string | null) =>
  useQuery({
    queryKey: ['geo', 'cities', country],
    queryFn: () => api.get(`/global/geo/countries/${country}/cities`) as unknown as Promise<CityInfo[]>,
    enabled: !!country,
    staleTime: Infinity,
    gcTime: Infinity,
  });

/** Mise en forme pendant la saisie : « 0707070707 » → « 07 07 07 07 07 » */
export const formatAsYouType = (value: string, country: string) => new AsYouType(country as CountryCode).input(value);

export const isPhoneValid = (national: string, country: string) => {
  try {
    return isValidPhoneNumber(national, country as CountryCode);
  } catch {
    return false;
  }
};

/** Numéro national + pays → +2250707070707 (null si invalide) */
export const toE164 = (national: string, country: string) => {
  const p = parsePhoneNumberFromString(national, country as CountryCode);
  return p && p.isValid() ? p.number : null;
};

/** +2250707070707 → « +225 07 07 07 07 07 » */
export const formatInternational = (e164: string) => parsePhoneNumberFromString(e164)?.formatInternational() || e164;
