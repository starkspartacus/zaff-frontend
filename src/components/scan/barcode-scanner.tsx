'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Keyboard, ScanLine } from 'lucide-react';

interface BarcodeScannerProps {
  /**
   * Appelé avec le code lu. `source` : `camera` (caméra), `scanner` (douchette : caractères tapés en rafale)
   * ou `keyboard` (saisie / collage à la main) — utile pour exiger un vrai scan de l'appareil.
   */
  onScan: (code: string, source: ScanSource) => void;
  /** Suspend la lecture caméra (ex. pendant une confirmation) */
  paused?: boolean;
  placeholder?: string;
  /** Démarrer directement la caméra (mobile) */
  autoStartCamera?: boolean;
  /** Aide affichée sous le champ */
  hint?: string;
}

export type ScanSource = 'camera' | 'scanner' | 'keyboard';

const SAME_CODE_DELAY_MS = 2500;
/** Une douchette « tape » chaque caractère en quelques millisecondes ; un humain en 100 ms ou plus */
const SCANNER_MAX_MS_PER_CHAR = 35;

export function BarcodeScanner({ onScan, paused = false, placeholder, autoStartCamera = false, hint }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  const [manual, setManual] = useState('');
  const [cameraOn, setCameraOn] = useState(autoStartCamera);
  const [cameraError, setCameraError] = useState<string | null>(null);
  /** Clavier du téléphone : chiffres (IMEI) ou lettres (N° de série) */
  const [numeric, setNumeric] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
    onScanRef.current = onScan;
  });

  /** Rythme de frappe du champ : sert à reconnaître une douchette */
  const typing = useRef<{ first: number; last: number; chars: number; pasted: boolean }>({ first: 0, last: 0, chars: 0, pasted: false });
  const emit = useCallback((raw: string, source: ScanSource) => {
    const code = raw.trim();
    if (!code || pausedRef.current) return;
    const now = Date.now();
    // La caméra relit le même code plusieurs fois par seconde : on l'ignore un instant
    if (code === lastScan.current.code && now - lastScan.current.at < SAME_CODE_DELAY_MS) return;
    lastScan.current = { code, at: now };
    onScanRef.current(code, source);
  }, []);

  // Caméra (ZXing : codes-barres 1D, QR, DataMatrix — Android et iPhone)
  useEffect(() => {
    if (!cameraOn) return;
    let stopped = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      setCameraError(null);
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraError("La caméra nécessite une connexion sécurisée (HTTPS). Utilisez la douchette ou la saisie manuelle.");
        setCameraOn(false);
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (stopped || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 });
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (result) emit(result.getText(), 'camera');
          }
        );
        if (stopped) controls.stop();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setCameraError(
          name === 'NotAllowedError'
            ? "Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur."
            : "Impossible d'ouvrir la caméra sur cet appareil."
        );
        setCameraOn(false);
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [cameraOn, emit]);

  // Douchette USB/Bluetooth : elle « tape » le code puis Entrée dans le champ
  useEffect(() => {
    if (!paused) inputRef.current?.focus();
  }, [paused]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    lastScan.current = { code: '', at: 0 }; // une saisie volontaire passe toujours
    const t = typing.current;
    const perChar = t.chars > 1 ? (t.last - t.first) / (t.chars - 1) : Infinity;
    const source: ScanSource = !t.pasted && manual.trim().length >= 6 && perChar <= SCANNER_MAX_MS_PER_CHAR ? 'scanner' : 'keyboard';
    emit(manual, source);
    typing.current = { first: 0, last: 0, chars: 0, pasted: false };
    setManual('');
  };

  return (
    <div className="space-y-3">
      {cameraOn && (
        <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-black aspect-[4/3] max-h-[50vh] mx-auto w-full">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {/* Viseur */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-4/5 h-1/3 rounded-2xl border-2 border-gold shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative">
              <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-gold/80 animate-pulse" />
            </div>
          </div>
          {paused && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-neutral-300">
              Lecture en pause
            </div>
          )}
        </div>
      )}

      <form onSubmit={submitManual} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gold" />
          <input
            ref={inputRef}
            value={manual}
            onChange={(e) => {
              const now = performance.now();
              const t = typing.current;
              const added = e.target.value.length - manual.length;
              if (!e.target.value) typing.current = { first: 0, last: 0, chars: 0, pasted: false };
              else {
                if (!t.chars) t.first = now;
                if (added > 1) t.pasted = true; // collage ou saisie automatique
                t.last = now;
                t.chars += Math.max(1, added);
              }
              setManual(e.target.value);
            }}
            placeholder={placeholder || 'Scannez ou tapez le N° de série / IMEI'}
            autoComplete="off"
            inputMode={numeric ? 'numeric' : 'text'}
            enterKeyHint="done"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full h-14 pl-11 pr-14 rounded-2xl bg-neutral-900 border border-neutral-800 text-white text-base font-mono placeholder:text-neutral-500 placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={() => {
              setNumeric((v) => !v);
              inputRef.current?.blur();
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2 rounded-lg bg-neutral-800 text-[10px] font-bold text-neutral-300 hover:text-white"
            title={numeric ? 'Clavier lettres et chiffres' : 'Clavier chiffres (IMEI)'}
            aria-label={numeric ? 'Clavier lettres et chiffres' : 'Clavier chiffres'}
          >
            {numeric ? 'ABC' : '123'}
          </button>
        </div>
        <button
          type="submit"
          className="h-14 px-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-gold text-xs font-semibold flex items-center gap-1.5"
          title="Valider la saisie"
        >
          <Keyboard className="w-4 h-4" /> OK
        </button>
        <button
          type="button"
          onClick={() => setCameraOn((v) => !v)}
          className={`h-14 px-4 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            cameraOn
              ? 'bg-gold border-gold text-ink'
              : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-gold'
          }`}
          title={cameraOn ? 'Arrêter la caméra' : 'Scanner avec la caméra'}
        >
          {cameraOn ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          <span className="hidden sm:inline">{cameraOn ? 'Arrêter' : 'Caméra'}</span>
        </button>
      </form>

      {cameraError && <p className="text-xs text-amber-400">{cameraError}</p>}
      {hint && <p className="text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}
