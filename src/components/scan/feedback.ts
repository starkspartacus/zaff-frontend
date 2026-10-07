/** Retour sonore + vibration après un scan (succès : bip aigu, erreur : double bip grave) */
export function scanFeedback(ok: boolean) {
  if (typeof window === 'undefined') return;
  try {
    navigator.vibrate?.(ok ? 80 : [120, 80, 120]);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tones = ok ? [[1200, 0]] : [[300, 0], [300, 0.18]];
    tones.forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + at);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.12);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Le retour est un confort : on ignore les navigateurs qui le bloquent
  }
}
