'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Store,
  UserRound,
} from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError } from '@/lib/api';
import { formatInternational, isPhoneValid, lastCountry, rememberCountry, toE164, useCities, useCountries } from '@/lib/geo';
import { Logo } from '@/components/ui/logo';
import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';
import { CommunePicker, CountrySelect, FieldError, FieldLabel, PhoneInput } from '@/components/forms/geo-fields';
import { SearchSelect } from '@/components/forms/search-select';
import { cn } from '@/lib/utils';

// ─── Étapes ───
const STEPS = [
  { icon: Store, title: 'Votre boutique', subtitle: 'Nom et pays' },
  { icon: MapPin, title: 'Adresse', subtitle: 'Ville et commune' },
  { icon: UserRound, title: 'Vous', subtitle: 'Téléphone et e-mail' },
  { icon: Lock, title: 'Sécurité', subtitle: 'Mot de passe' },
] as const;

interface Form {
  name: string;
  countryCode: string;
  city: string;
  commune: string | null;
  address: string;
  shopPhone: string;
  ownerName: string;
  ownerPhone: string;
  ownerPhoneCountry: string;
  ownerEmail: string;
  password: string;
  confirm: string;
}

type Errors = Partial<Record<keyof Form, string>>;
type Conflict = { code: 'PHONE_TAKEN' | 'EMAIL_TAKEN'; value: string } | null;

const emailSchema = z.email('Adresse e-mail invalide (exemple : nom@gmail.com).');

/** Force du mot de passe : 0 à 4 */
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (pw.length >= 12 || /[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH = ['Trop court', 'Faible', 'Correct', 'Bon', 'Excellent'];

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [initialCountry] = useState(() => (typeof window === 'undefined' ? 'CI' : lastCountry()));
  const [f, setF] = useState<Form>({
    name: '',
    countryCode: initialCountry,
    city: '',
    commune: null,
    address: '',
    shopPhone: '',
    ownerName: '',
    ownerPhone: '',
    ownerPhoneCountry: initialCountry,
    ownerEmail: '',
    password: '',
    confirm: '',
  });
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<Conflict>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState<{ name: string; ownerName: string } | null>(null);

  const { data: countries = [] } = useCountries();
  const { data: cities = [], isLoading: citiesLoading } = useCities(f.countryCode);
  const country = countries.find((c) => c.code === f.countryCode);
  const city = cities.find((c) => c.name === f.city);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const changeCountry = (code: string) => {
    // Le pays de la boutique donne aussi l'indicatif du propriétaire (modifiable)
    setF((prev) => ({ ...prev, countryCode: code, city: '', commune: null, ownerPhoneCountry: code, shopPhone: '' }));
    setErrors({});
  };

  // ─── Validation de chaque étape ───
  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (f.name.trim().length < 2) e.name = 'Indiquez le nom de votre boutique.';
      if (!country) e.countryCode = 'Choisissez votre pays.';
    }
    if (s === 1) {
      if (!f.city.trim()) e.city = cities.length ? 'Choisissez votre ville.' : 'Indiquez votre ville.';
      if (city?.communeRequired && !f.commune) e.commune = `Choisissez votre commune à ${city.name}.`;
      if (f.shopPhone && !isPhoneValid(f.shopPhone, f.countryCode)) e.shopPhone = `Numéro invalide pour ${country?.name}.`;
    }
    if (s === 2) {
      if (f.ownerName.trim().length < 2) e.ownerName = 'Indiquez votre nom et prénom.';
      if (!isPhoneValid(f.ownerPhone, f.ownerPhoneCountry)) {
        const c = countries.find((x) => x.code === f.ownerPhoneCountry);
        e.ownerPhone = `Numéro invalide pour ${c?.name || 'ce pays'} (${c?.dialCode || ''}).${c?.example ? ` Exemple : ${c.example}` : ''}`;
      }
      if (!emailSchema.safeParse(f.ownerEmail.trim()).success) e.ownerEmail = 'Adresse e-mail obligatoire et valide (exemple : nom@gmail.com).';
    }
    if (s === 3) {
      if (f.password.length < 8) e.password = 'Au moins 8 caractères.';
      else if (!/\d/.test(f.password) || !/[A-Za-zÀ-ÿ]/.test(f.password)) e.password = 'Au moins une lettre et un chiffre.';
      if (f.confirm !== f.password) e.confirm = 'Les deux mots de passe ne correspondent pas.';
    }
    return e;
  };

  /** Numéro et e-mail déjà utilisés ? Vérifié avant de passer à l'étape suivante */
  const checkAvailability = async () => {
    setChecking(true);
    try {
      const res = (await api.post('/global/establishments/check', {
        countryCode: f.ownerPhoneCountry,
        phone: f.ownerPhone,
        email: f.ownerEmail.trim(),
      })) as unknown as { phone?: { taken: boolean; e164: string | null }; email?: { taken: boolean } };
      if (res.phone?.taken) {
        setConflict({ code: 'PHONE_TAKEN', value: formatInternational(res.phone.e164 || '') });
        return false;
      }
      if (res.email?.taken) {
        setConflict({ code: 'EMAIL_TAKEN', value: f.ownerEmail.trim().toLowerCase() });
        return false;
      }
      return true;
    } catch {
      return true; // le serveur revérifie à l'inscription
    } finally {
      setChecking(false);
    }
  };

  const go = (to: number) => {
    setDirection(to > step ? 1 : -1);
    setStep(to);
    setSubmitError(null);
  };

  const next = async () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step === 2 && !(await checkAvailability())) return;
    go(step + 1);
  };

  const submit = async () => {
    const e = validate(3);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    setSubmitError(null);
    const ownerPhone = toE164(f.ownerPhone, f.ownerPhoneCountry) || f.ownerPhone;
    try {
      await api.post('/global/establishments', {
        name: f.name.trim(),
        countryCode: f.countryCode,
        city: f.city.trim(),
        commune: f.commune || undefined,
        address: f.address.trim() || undefined,
        shopPhone: f.shopPhone ? toE164(f.shopPhone, f.countryCode) || f.shopPhone : undefined,
        ownerName: f.ownerName.trim(),
        ownerPhone,
        ownerEmail: f.ownerEmail.trim().toLowerCase(),
        password: f.password,
      });
      rememberCountry(f.ownerPhoneCountry);
      setDone({ name: f.name.trim(), ownerName: f.ownerName.trim().split(' ')[0] });
      celebrate();
      // Connexion automatique avec le numéro qu'il vient de créer
      setTimeout(() => {
        login(ownerPhone, f.password, undefined, f.ownerPhoneCountry).catch(() => router.push('/login'));
      }, 2600);
    } catch (err) {
      const code = err instanceof ApiError ? (err.details?.code as string | undefined) : undefined;
      if (code === 'PHONE_TAKEN') setConflict({ code, value: formatInternational(ownerPhone) });
      else if (code === 'EMAIL_TAKEN') setConflict({ code, value: f.ownerEmail.trim().toLowerCase() });
      else setSubmitError(err instanceof Error ? err.message : 'Inscription impossible, réessayez.');
      setSubmitting(false);
    }
  };

  const cityOptions = useMemo(() => cities.map((c) => ({ value: c.name, label: c.name, hint: c.communes?.length ? `${c.communes.length} communes` : undefined })), [cities]);
  const pw = strength(f.password);

  if (done) return <Success shop={done.name} owner={done.ownerName} />;

  return (
    <div className="relative min-h-screen bg-black overflow-clip px-4 py-8 sm:py-12">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-gold/15 to-transparent rounded-full blur-[130px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Accueil
          </Link>
          <Link href="/login" className="text-xs text-neutral-400 hover:text-white">
            Déjà inscrit ? <span className="text-gold font-semibold">Se connecter</span>
          </Link>
        </div>

        <div className="text-center mb-6">
          <Logo size="sm" className="mx-auto" />
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-3">Créez votre boutique</h1>
          <p className="text-sm text-neutral-400 mt-1">4 étapes simples · environ 2 minutes</p>
        </div>

        <div className="grid lg:grid-cols-[230px_1fr] gap-6">
          <Timeline step={step} onGo={(i) => i < step && go(i)} />

          <div className="relative rounded-3xl border border-neutral-800 bg-neutral-950/90 backdrop-blur-md p-5 sm:p-7 overflow-hidden">
            <BorderBeam size={140} duration={9} />
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ x: direction * 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -40, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-5"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gold font-semibold">Étape {step + 1} sur 4</p>
                  <h2 className="text-xl font-bold text-white">{STEPS[step].title}</h2>
                </div>

                {step === 0 && (
                  <>
                    <div>
                      <FieldLabel htmlFor="name">Nom de la boutique</FieldLabel>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input
                          id="name"
                          autoFocus
                          value={f.name}
                          onChange={(e) => set('name', e.target.value)}
                          placeholder="Ex. : Zaff Phone Center"
                          maxLength={80}
                          className={inputCls(!!errors.name, true)}
                        />
                      </div>
                      <FieldError msg={errors.name} />
                    </div>
                    <div>
                      <FieldLabel>Pays</FieldLabel>
                      <CountrySelect value={f.countryCode} onChange={changeCountry} invalid={!!errors.countryCode} />
                      <FieldError msg={errors.countryCode} />
                    </div>
                    {country && (
                      <BlurFade key={country.code} className="rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 flex items-center justify-between text-sm">
                        <span className="text-neutral-300">Devise de la boutique</span>
                        <span className="font-bold text-gold-soft">
                          {country.currency.name} ({country.currency.symbol})
                        </span>
                      </BlurFade>
                    )}
                  </>
                )}

                {step === 1 && (
                  <>
                    <div>
                      <FieldLabel>Ville</FieldLabel>
                      {cities.length > 0 || citiesLoading ? (
                        <SearchSelect
                          value={f.city || null}
                          onChange={(v) => {
                            setF((prev) => ({ ...prev, city: v, commune: null }));
                            setErrors((e) => ({ ...e, city: undefined, commune: undefined }));
                          }}
                          options={cityOptions}
                          disabled={citiesLoading}
                          invalid={!!errors.city}
                          placeholder={citiesLoading ? 'Chargement des villes…' : `Choisissez la ville (${country?.name})`}
                          searchPlaceholder="Nom de la ville"
                          title={`Villes — ${country?.name}`}
                        />
                      ) : (
                        <input value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Votre ville" maxLength={80} className={inputCls(!!errors.city)} />
                      )}
                      <FieldError msg={errors.city} />
                    </div>

                    <AnimatePresence>
                      {city?.communes?.length ? (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <FieldLabel optional={!city.communeRequired}>Commune {city.communeRequired && <span className="text-gold">(obligatoire)</span>}</FieldLabel>
                          <CommunePicker communes={city.communes} value={f.commune} onChange={(c) => set('commune', c)} invalid={!!errors.commune} />
                          <FieldError msg={errors.commune} />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <div>
                      <FieldLabel htmlFor="address" optional>
                        Quartier, repère
                      </FieldLabel>
                      <input
                        id="address"
                        value={f.address}
                        onChange={(e) => set('address', e.target.value)}
                        placeholder="Ex. : Riviera 2, à côté de la pharmacie"
                        maxLength={160}
                        className={inputCls(false)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="shopPhone" optional>
                        Téléphone de la boutique (fixe ou WhatsApp)
                      </FieldLabel>
                      <PhoneInput
                        id="shopPhone"
                        country={f.countryCode}
                        onCountryChange={() => undefined}
                        lockCountry
                        value={f.shopPhone}
                        onChange={(v) => set('shopPhone', v)}
                        invalid={!!errors.shopPhone}
                      />
                      <FieldError msg={errors.shopPhone} />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div>
                      <FieldLabel htmlFor="ownerName">Votre nom et prénom</FieldLabel>
                      <div className="relative">
                        <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input
                          id="ownerName"
                          autoFocus
                          autoComplete="name"
                          value={f.ownerName}
                          onChange={(e) => set('ownerName', e.target.value)}
                          placeholder="Ex. : Michel Koffi"
                          maxLength={80}
                          className={inputCls(!!errors.ownerName, true)}
                        />
                      </div>
                      <FieldError msg={errors.ownerName} />
                    </div>
                    <div>
                      <FieldLabel htmlFor="ownerPhone">Votre numéro de téléphone (pour vous connecter)</FieldLabel>
                      <PhoneInput
                        id="ownerPhone"
                        country={f.ownerPhoneCountry}
                        onCountryChange={(c) => {
                          setF((prev) => ({ ...prev, ownerPhoneCountry: c, ownerPhone: '' }));
                          setErrors((e) => ({ ...e, ownerPhone: undefined }));
                        }}
                        value={f.ownerPhone}
                        onChange={(v) => set('ownerPhone', v)}
                        invalid={!!errors.ownerPhone}
                      />
                      <FieldError msg={errors.ownerPhone} />
                    </div>
                    <div>
                      <FieldLabel htmlFor="ownerEmail">Votre adresse e-mail</FieldLabel>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input
                          id="ownerEmail"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          value={f.ownerEmail}
                          onChange={(e) => set('ownerEmail', e.target.value)}
                          placeholder="nom@gmail.com"
                          maxLength={120}
                          className={inputCls(!!errors.ownerEmail, true)}
                        />
                      </div>
                      <FieldError msg={errors.ownerEmail} />
                      <p className="text-[11px] text-neutral-500 mt-1.5">Vous pourrez vous connecter avec votre numéro ou votre e-mail.</p>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div>
                      <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input
                          id="password"
                          autoFocus
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={f.password}
                          onChange={(e) => set('password', e.target.value)}
                          placeholder="8 caractères, lettres et chiffres"
                          className={cn(inputCls(!!errors.password, true), 'pr-11')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-white"
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex gap-1 mt-2" aria-hidden>
                        {[0, 1, 2, 3].map((i) => (
                          <motion.span
                            key={i}
                            className="h-1.5 flex-1 rounded-full"
                            animate={{ backgroundColor: i < pw ? ['#ef4444', '#f59e0b', '#d4a017', '#10b981'][pw - 1] : '#262626' }}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">{f.password ? `Sécurité : ${STRENGTH[pw]}` : 'Évitez votre date de naissance ou votre numéro.'}</p>
                      <FieldError msg={errors.password} />
                    </div>
                    <div>
                      <FieldLabel htmlFor="confirm">Confirmez le mot de passe</FieldLabel>
                      <input
                        id="confirm"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={f.confirm}
                        onChange={(e) => set('confirm', e.target.value)}
                        className={inputCls(!!errors.confirm)}
                      />
                      <FieldError msg={errors.confirm} />
                    </div>

                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-2 text-sm">
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Récapitulatif</p>
                      <Recap icon={Store} label={f.name} sub={`${country?.flag || ''} ${country?.name || ''} · ${country?.currency.symbol || ''}`} onEdit={() => go(0)} />
                      <Recap icon={MapPin} label={[f.commune, f.city].filter(Boolean).join(', ')} sub={f.address || undefined} onEdit={() => go(1)} />
                      <Recap
                        icon={Phone}
                        label={`${f.ownerName} · ${formatInternational(toE164(f.ownerPhone, f.ownerPhoneCountry) || f.ownerPhone)}`}
                        sub={f.ownerEmail}
                        onEdit={() => go(2)}
                      />
                    </div>
                    {submitError && (
                      <p className="text-sm text-red-400 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {submitError}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-3 pt-6 mt-6 border-t border-neutral-900">
              {step > 0 && (
                <button type="button" onClick={() => go(step - 1)} className="h-12 px-4 rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-300 text-sm font-semibold flex items-center gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={checking}
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {checking ? 'Vérification…' : 'Continuer'} <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-extrabold text-sm disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
                >
                  {submitting ? (
                    <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Créer ma boutique
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConflictModal
        conflict={conflict}
        onClose={() => setConflict(null)}
        onFix={() => {
          const field = conflict?.code === 'PHONE_TAKEN' ? 'ownerPhone' : 'ownerEmail';
          setConflict(null);
          go(2);
          setErrors({ [field]: conflict?.code === 'PHONE_TAKEN' ? 'Ce numéro est déjà utilisé : choisissez-en un autre.' : 'Cet e-mail est déjà utilisé : choisissez-en un autre.' });
        }}
        onLogin={() => router.push('/login')}
      />
    </div>
  );
}

const inputCls = (invalid: boolean, withIcon = false) =>
  cn(
    'w-full h-12 rounded-xl bg-neutral-900 border text-sm text-white placeholder:text-neutral-500 focus:outline-none',
    withIcon ? 'pl-10 pr-3.5' : 'px-3.5',
    invalid ? 'border-red-500/60' : 'border-neutral-800 focus:border-gold'
  );

/** Frise des étapes : horizontale sur téléphone, verticale sur ordinateur */
function Timeline({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  const progress = (step / (STEPS.length - 1)) * 100;
  return (
    <nav aria-label="Étapes de l'inscription" className="relative">
      {/* Ligne de progression */}
      <div className="absolute left-5 right-5 top-5 h-0.5 bg-neutral-800 lg:left-5 lg:right-auto lg:top-5 lg:bottom-5 lg:h-auto lg:w-0.5">
        <motion.div
          className="h-full lg:h-auto lg:w-full bg-gradient-to-r lg:bg-gradient-to-b from-gold to-gold-soft"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{ maxWidth: '100%' }}
        />
      </div>
      <motion.div
        className="hidden lg:block absolute left-5 top-5 w-0.5 bg-gradient-to-b from-gold to-gold-soft"
        initial={false}
        animate={{ height: `calc(${progress}% - ${progress ? 0 : 0}px)` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
      <ol className="relative flex lg:flex-col justify-between lg:justify-start lg:gap-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? 'done' : i === step ? 'current' : 'todo';
          return (
            <li key={s.title} className="flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-3">
              <button
                type="button"
                onClick={() => onGo(i)}
                disabled={state !== 'done'}
                aria-current={state === 'current' ? 'step' : undefined}
                className="relative w-10 h-10 shrink-0"
              >
                {state === 'current' && <span className="absolute inset-0 rounded-full bg-gold/30 animate-ping" />}
                <motion.span
                  className={cn(
                    'relative w-10 h-10 rounded-full border-2 flex items-center justify-center',
                    state === 'done' && 'bg-gold border-gold text-ink',
                    state === 'current' && 'bg-neutral-950 border-gold text-gold-soft',
                    state === 'todo' && 'bg-neutral-950 border-neutral-700 text-neutral-500'
                  )}
                  initial={false}
                  animate={{ scale: state === 'current' ? 1.08 : 1 }}
                >
                  {state === 'done' ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </motion.span>
              </button>
              <div className="text-center lg:text-left lg:pt-1">
                <p className={cn('text-[11px] lg:text-sm font-semibold', state === 'todo' ? 'text-neutral-500' : 'text-white')}>{s.title}</p>
                <p className="hidden lg:block text-[11px] text-neutral-500">{s.subtitle}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Recap({ icon: Icon, label, sub, onEdit }: { icon: React.ElementType; label: string; sub?: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className="w-4 h-4 text-gold mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-white truncate">{label}</p>
          {sub && <p className="text-[11px] text-neutral-500 truncate">{sub}</p>}
        </div>
      </div>
      <button type="button" onClick={onEdit} className="text-[11px] text-neutral-400 hover:text-white underline underline-offset-2 shrink-0">
        Modifier
      </button>
    </div>
  );
}

/** Numéro ou e-mail déjà utilisé : on explique et on propose les deux sorties possibles */
function ConflictModal({ conflict, onClose, onFix, onLogin }: { conflict: Conflict; onClose: () => void; onFix: () => void; onLogin: () => void }) {
  const isPhone = conflict?.code === 'PHONE_TAKEN';
  return (
    <AnimatePresence>
      {conflict && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="alertdialog"
            aria-labelledby="conflict-title"
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-amber-500/30 bg-neutral-950 p-6 text-center space-y-4 overflow-hidden"
          >
            <BorderBeam size={90} duration={6} colorFrom="#fbbf24" colorTo="#d4a017" />
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
              {isPhone ? <Phone className="w-7 h-7 text-amber-400" /> : <Mail className="w-7 h-7 text-amber-400" />}
            </div>
            <div>
              <h2 id="conflict-title" className="text-lg font-bold text-white">
                {isPhone ? 'Ce numéro a déjà un compte' : 'Cet e-mail a déjà un compte'}
              </h2>
              <p className="text-sm font-mono text-gold-soft mt-1 break-all">{conflict.value}</p>
              <p className="text-sm text-neutral-400 mt-2">
                {isPhone
                  ? 'Un numéro ne peut être utilisé que pour un seul compte ZAFF dans un même pays.'
                  : 'Une adresse e-mail ne peut être utilisée que pour un seul compte ZAFF.'}{' '}
                Si c&apos;est le vôtre, connectez-vous ; sinon, utilisez-en un autre.
              </p>
            </div>
            <div className="grid gap-2">
              <button onClick={onLogin} className="h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-sm flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" /> C&apos;est mon compte, me connecter
              </button>
              <button onClick={onFix} className="h-12 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold">
                {isPhone ? 'Utiliser un autre numéro' : 'Utiliser un autre e-mail'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function celebrate() {
  const colors = ['#d4a017', '#f5d77f', '#ffffff', '#e5b83b'];
  confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors });
  setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 }, colors }), 250);
  setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 }, colors }), 400);
}

function Success({ shop, owner }: { shop: string; owner: string }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        className="relative max-w-sm w-full rounded-3xl border border-emerald-500/30 bg-neutral-950 p-8 text-center space-y-4 overflow-hidden"
      >
        <BorderBeam size={120} duration={5} colorFrom="#34d399" colorTo="#d4a017" />
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 14 }}
          className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-400 flex items-center justify-center mx-auto"
        >
          <Check className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <div>
          <p className="text-2xl font-black text-white">Bienvenue {owner} !</p>
          <p className="text-sm text-neutral-400 mt-1">
            <strong className="text-gold-soft">{shop}</strong> est prête.
          </p>
        </div>
        <p className="text-xs text-neutral-500 flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-gold/40 border-t-gold rounded-full animate-spin" /> Ouverture de votre espace…
        </p>
      </motion.div>
    </div>
  );
}
