'use client';

import React, { useEffect, useState } from 'react';
import { BellRing, Smartphone, X } from 'lucide-react';
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push';
import { cn } from '@/lib/utils';

const HINT: Partial<Record<PushState, string>> = {
  'ios-install': "Sur iPhone : touchez Partager puis « Sur l'écran d'accueil », ouvrez ZAFF depuis l'icône, puis activez.",
  denied: 'Notifications bloquées : autorisez-les dans les réglages du navigateur pour ce site.',
  unsupported: 'Ce navigateur ne permet pas les notifications push.',
};

function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  const toggle = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setState(state === 'on' ? await disablePush() : await enablePush());
    } catch {
      // Ex. service push du navigateur injoignable (réseau, mode privé)
      setFailed(true);
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };
  return { state, busy, toggle, failed };
}

/** Interrupteur « Notifications sur cet appareil » (centre de notifications) */
export function PushToggle() {
  const { state, busy, toggle, failed } = usePushState();
  if (!state || state === 'server-off') return null;
  const canToggle = state === 'on' || state === 'off';
  return (
    <div className="px-4 py-3 border-t border-neutral-900 space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-neutral-300">
          <Smartphone className="w-4 h-4 text-[#d4a017]" /> Notifications sur cet appareil
        </span>
        {canToggle && (
          <button
            onClick={toggle}
            disabled={busy}
            role="switch"
            aria-checked={state === 'on'}
            className={cn('relative w-10 h-6 rounded-full transition-colors disabled:opacity-50', state === 'on' ? 'bg-[#d4a017]' : 'bg-neutral-700')}
          >
            <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', state === 'on' ? 'left-[18px]' : 'left-0.5')} />
          </button>
        )}
      </div>
      {HINT[state] && <p className="text-[11px] text-neutral-500">{HINT[state]}</p>}
      {failed && <p className="text-[11px] text-red-400">Activation impossible pour le moment. Vérifiez la connexion internet et réessayez.</p>}
    </div>
  );
}

const DISMISS_KEY = 'zaff-push-prompt-dismissed';

/** Bandeau sur l'accueil du propriétaire : recevoir chaque vente sur son téléphone */
export function PushPrompt() {
  const { state, busy, toggle, failed } = usePushState();
  // Rien n'est affiché avant que l'état push soit connu : pas d'écart entre serveur et navigateur
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (dismissed || !state || !['off', 'ios-install'].includes(state)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // préférence non mémorisée : le bandeau reviendra
    }
  };

  return (
    <div className="relative rounded-3xl border border-[#d4a017]/40 bg-[#d4a017]/5 p-4 pr-10 flex flex-col sm:flex-row sm:items-center gap-3">
      <button onClick={dismiss} className="absolute top-3 right-3 p-1 text-neutral-500 hover:text-white" aria-label="Plus tard">
        <X className="w-4 h-4" />
      </button>
      <div className="w-10 h-10 rounded-2xl bg-[#d4a017]/15 border border-[#d4a017]/40 flex items-center justify-center text-[#d4a017] shrink-0">
        <BellRing className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">Recevez chaque vente sur votre téléphone</p>
        <p className="text-xs text-neutral-400">
          {state === 'ios-install' ? HINT['ios-install'] : 'Même application fermée : ventes, stock bas et clôtures de caisse.'}
        </p>
        {failed && <p className="text-xs text-red-400 mt-1">Activation impossible pour le moment. Vérifiez la connexion et réessayez.</p>}
      </div>
      {state === 'off' && (
        <button
          onClick={toggle}
          disabled={busy}
          className="h-10 px-4 rounded-xl bg-[#d4a017] text-black font-bold text-xs disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <BellRing className="w-4 h-4" /> Activer
        </button>
      )}
    </div>
  );
}

