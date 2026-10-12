'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Fond animé plein écran façon « vidéo hero » pour ZAFF.
 *
 * Rendu en <canvas> :
 * - grille perspective dorée (style Tron / cyberpunk)
 * - particules lumineuses montantes
 * - traces de circuits imprimés qui se dessinent
 * - halo pulsant central
 *
 * Le canvas est positionné en absolute/inset-0 et n'intercepte pas les clics.
 */
export function HeroBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0;
    let h = 0;

    // ── Particules ──
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      life: number;
      maxLife: number;
      hue: number;
    }

    const particles: Particle[] = [];
    const PARTICLE_COUNT = 60;

    function spawnParticle(): Particle {
      return {
        x: Math.random() * w,
        y: h + Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.3 + Math.random() * 0.8),
        r: 1 + Math.random() * 2.5,
        life: 0,
        maxLife: 200 + Math.random() * 300,
        hue: 35 + Math.random() * 20, // gold range
      };
    }

    // ── Circuits ──
    interface CircuitLine {
      points: { x: number; y: number }[];
      progress: number;
      speed: number;
      alpha: number;
    }

    const circuits: CircuitLine[] = [];
    const CIRCUIT_COUNT = 8;

    function spawnCircuit(): CircuitLine {
      const startX = Math.random() * w;
      const startY = Math.random() * h;
      const points = [{ x: startX, y: startY }];
      let cx = startX;
      let cy = startY;
      const segs = 4 + Math.floor(Math.random() * 6);
      for (let i = 0; i < segs; i++) {
        const horizontal = Math.random() > 0.5;
        const dist = 30 + Math.random() * 80;
        if (horizontal) cx += (Math.random() > 0.5 ? 1 : -1) * dist;
        else cy += (Math.random() > 0.5 ? 1 : -1) * dist;
        points.push({ x: cx, y: cy });
      }
      return { points, progress: 0, speed: 0.003 + Math.random() * 0.004, alpha: 0.15 + Math.random() * 0.2 };
    }

    // ── Resize ──
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Init
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = spawnParticle();
      p.y = Math.random() * h;
      p.life = Math.random() * p.maxLife;
      particles.push(p);
    }
    for (let i = 0; i < CIRCUIT_COUNT; i++) circuits.push(spawnCircuit());

    // ── Draw ──
    function draw(t: number) {
      ctx.clearRect(0, 0, w, h);

      // Fond sombre dégradé radial
      const bg = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.85);
      bg.addColorStop(0, 'rgba(30, 20, 5, 0.6)');
      bg.addColorStop(0.5, 'rgba(10, 10, 10, 0.7)');
      bg.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ── Grille perspective ──
      const vanishY = h * 0.32;
      const vanishX = w / 2;
      const gridAlpha = 0.06 + Math.sin(t * 0.0008) * 0.02;
      ctx.strokeStyle = `rgba(212, 160, 23, ${gridAlpha})`;
      ctx.lineWidth = 0.5;

      // Lignes horizontales
      const hLines = 18;
      for (let i = 0; i <= hLines; i++) {
        const frac = i / hLines;
        const y = vanishY + (h - vanishY) * (frac * frac); // accélère vers le bas
        const spread = 0.1 + frac * 0.9;
        const x1 = vanishX - (w * 0.7) * spread;
        const x2 = vanishX + (w * 0.7) * spread;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }

      // Lignes verticales convergentes
      const vLines = 14;
      for (let i = 0; i <= vLines; i++) {
        const frac = i / vLines;
        const bottomX = w * 0.15 + (w * 0.7) * frac;
        ctx.beginPath();
        ctx.moveTo(vanishX, vanishY);
        ctx.lineTo(bottomX, h);
        ctx.stroke();
      }

      // ── Halo central pulsant ──
      const pulse = 0.5 + Math.sin(t * 0.001) * 0.3 + Math.sin(t * 0.003) * 0.2;
      const halo = ctx.createRadialGradient(vanishX, vanishY, 0, vanishX, vanishY, 250);
      halo.addColorStop(0, `rgba(234, 179, 8, ${0.12 * pulse})`);
      halo.addColorStop(0.4, `rgba(212, 160, 23, ${0.05 * pulse})`);
      halo.addColorStop(1, 'rgba(212, 160, 23, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // ── Circuits ──
      for (const c of circuits) {
        c.progress += c.speed;
        if (c.progress > 1.3) {
          Object.assign(c, spawnCircuit());
          continue;
        }
        const totalLen = c.points.length - 1;
        const drawSegs = Math.min(Math.floor(c.progress * totalLen), totalLen);
        const partialFrac = (c.progress * totalLen) - drawSegs;

        ctx.beginPath();
        ctx.moveTo(c.points[0].x, c.points[0].y);
        for (let i = 1; i <= drawSegs; i++) {
          ctx.lineTo(c.points[i].x, c.points[i].y);
        }
        if (drawSegs < totalLen) {
          const from = c.points[drawSegs];
          const to = c.points[drawSegs + 1];
          ctx.lineTo(from.x + (to.x - from.x) * partialFrac, from.y + (to.y - from.y) * partialFrac);
        }
        const fade = c.progress > 1 ? 1 - (c.progress - 1) / 0.3 : 1;
        ctx.strokeStyle = `rgba(212, 160, 23, ${c.alpha * Math.max(fade, 0)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Noeud lumineux au bout
        if (drawSegs < totalLen && fade > 0) {
          const from = c.points[drawSegs];
          const to = c.points[drawSegs + 1];
          const nx = from.x + (to.x - from.x) * partialFrac;
          const ny = from.y + (to.y - from.y) * partialFrac;
          const dot = ctx.createRadialGradient(nx, ny, 0, nx, ny, 4);
          dot.addColorStop(0, `rgba(253, 224, 71, ${0.8 * fade})`);
          dot.addColorStop(1, 'rgba(253, 224, 71, 0)');
          ctx.fillStyle = dot;
          ctx.fillRect(nx - 4, ny - 4, 8, 8);
        }
      }

      // ── Particules montantes ──
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.y < -10) {
          particles[i] = spawnParticle();
          continue;
        }
        const a = Math.sin((p.life / p.maxLife) * Math.PI);
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        glow.addColorStop(0, `hsla(${p.hue}, 90%, 65%, ${a * 0.7})`);
        glow.addColorStop(0.5, `hsla(${p.hue}, 80%, 50%, ${a * 0.2})`);
        glow.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);
      }

      // ── Scanline subtile ──
      const scanY = (t * 0.05) % h;
      const scanGrad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2);
      scanGrad.addColorStop(0, 'rgba(212, 160, 23, 0)');
      scanGrad.addColorStop(0.5, 'rgba(212, 160, 23, 0.04)');
      scanGrad.addColorStop(1, 'rgba(212, 160, 23, 0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 2, w, 4);

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    />
  );
}
