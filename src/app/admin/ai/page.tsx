'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, CircleStop, ExternalLink, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import {
  cancelAiJob,
  createAiJob,
  fetchAiPreview,
  publishAiCandidate,
  publishAiCandidates,
  rejectAiCandidate,
  useAdminRefresh,
  useAiCandidates,
  useAiJobs,
  useAiStatus,
  type AiCandidate,
  type AiJob,
} from '@/lib/admin-api';
import { errorMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

const COUNTS = [10, 25, 50, 100];

/**
 * Photos par l'IA : Gemini cherche les photos officielles des appareils, ZAFF les met au format (carré blanc WebP
 * + vignette), l'IA vérifie modèle / coloris / qualité et note chaque photo ; l'admin publie en un clic
 * (ou laisse publier automatiquement les meilleures). Publier envoie la photo chez UploadThing et aux boutiques.
 */
export default function AdminAiPage() {
  const status = useAiStatus().data;
  const { data: jobs = [] } = useAiJobs();
  const active = jobs.some((j) => j.status === 'running' || j.status === 'queued');
  const [jobFilter, setJobFilter] = useState<string>('');
  const { data: candidates = [], isLoading } = useAiCandidates({ status: 'pending', jobId: jobFilter || undefined }, active);
  const refresh = useAdminRefresh();
  const [count, setCount] = useState(25);
  const [auto, setAuto] = useState(false);
  const [minScore, setMinScore] = useState(90);
  const [bulkScore, setBulkScore] = useState(80);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [zoom, setZoom] = useState<AiCandidate | null>(null);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ tone: 'ok', text });
      await refresh();
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  // Propositions regroupées par appareil, les mieux notées d'abord
  const groups = useMemo(() => {
    const map = new Map<string, AiCandidate[]>();
    for (const c of candidates) map.set(c.deviceId, [...(map.get(c.deviceId) || []), c]);
    return [...map.entries()].sort((a, b) => b[1][0].score - a[1][0].score);
  }, [candidates]);
  const aboveBulk = candidates.filter((c) => c.score >= bulkScore).length;

  if (status && !status.enabled) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold text-white">Photos par l&apos;IA</h1>
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-neutral-200 space-y-2">
          <p className="font-bold text-white">L&apos;IA n&apos;est pas encore configurée sur le serveur.</p>
          <p>
            Ajoutez votre clé Google Gemini dans le fichier <code className="text-gold-soft">.env</code> du backend : <code className="text-gold-soft">GEMINI_API_KEY=…</code>{' '}
            (Google AI Studio → « Get API key »), puis redémarrez le serveur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-gold" /> Photos par l&apos;IA
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 max-w-3xl">
            L&apos;IA cherche les photos officielles de chaque modèle, ZAFF les met au même format (carré blanc, WebP léger + vignette), puis l&apos;IA vérifie
            le modèle, le coloris et la qualité et donne une note. Publier envoie la photo sur UploadThing et la transmet aux produits des boutiques.
          </p>
        </div>
        {status && <span className="px-2.5 py-1 rounded-full border border-neutral-700 text-[11px] text-neutral-400">Modèle : {status.model}</span>}
      </div>

      {/* Lancer une recherche */}
      <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
        <h2 className="text-sm font-bold text-white">Chercher les photos manquantes</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400">Appareils sans photo, les plus utilisés par les boutiques d&apos;abord :</span>
          {COUNTS.map((n) => (
            <Chip key={n} on={count === n} onClick={() => setCount(n)}>
              {n}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Mode on={!auto} onClick={() => setAuto(false)} title="Je valide chaque photo" text="Les photos attendent votre accord ci-dessous (recommandé au début)." />
          <Mode
            on={auto}
            onClick={() => setAuto(true)}
            title="Publication automatique"
            text={`Les photos notées ${minScore}/100 ou plus sont publiées directement ; les autres attendent votre accord.`}
          />
        </div>
        {auto && (
          <label className="flex items-center gap-3 text-xs text-neutral-300">
            Note minimale
            <input type="range" min={70} max={100} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="accent-[var(--color-gold)]" />
            <strong className="text-white">{minScore}</strong>
          </label>
        )}
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const job = await createAiJob({ selection: 'missing-popular', limit: count, auto, minScore });
              return `Recherche lancée : ${job.label}. Vous pouvez quitter la page, le travail continue sur le serveur.`;
            })
          }
          className="h-12 px-5 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink text-sm font-bold flex items-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Lancer la recherche
        </button>
        {message && <p className={cn('text-xs', message.tone === 'ok' ? 'text-emerald-400' : 'text-red-400')}>{message.text}</p>}
      </section>

      {/* Lots */}
      {jobs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white">Recherches</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {jobs.slice(0, 6).map((j) => (
              <JobCard key={j.id} job={j} selected={jobFilter === j.id} onSelect={() => setJobFilter(jobFilter === j.id ? '' : j.id)} onCancel={() => run(async () => void (await cancelAiJob(j.id)))} />
            ))}
          </div>
        </section>
      )}

      {/* Photos à valider */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Photos à valider ({candidates.length}){jobFilter && <span className="font-normal text-neutral-500"> · recherche sélectionnée</span>}
            </h2>
            <p className="text-[11px] text-neutral-500">Vérifiez le modèle et le coloris : une photo publiée est vue par toutes les boutiques.</p>
          </div>
          {candidates.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              Publier tout ce qui est noté ≥
              <select value={bulkScore} onChange={(e) => setBulkScore(Number(e.target.value))} className="h-9 px-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white" aria-label="Note minimale">
                {[95, 90, 85, 80, 75, 70].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !aboveBulk}
                onClick={() =>
                  run(async () => {
                    const r = await publishAiCandidates({ jobId: jobFilter || undefined, minScore: bulkScore });
                    return `${r.published} photo(s) publiée(s)${r.failed ? `, ${r.failed} en échec` : ''}.`;
                  })
                }
                className="h-9 px-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> {aboveBulk} photo{aboveBulk > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
        {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}
        {!isLoading && candidates.length === 0 && (
          <p className="rounded-3xl border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500">
            {active ? "Recherche en cours : les photos apparaissent ici au fur et à mesure." : 'Aucune photo en attente.'}
          </p>
        )}
        <div className="space-y-4">
          {groups.map(([deviceId, list]) => (
            <div key={deviceId} className="rounded-3xl border border-neutral-800 bg-neutral-950 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white truncate">
                  {list[0].device ? `${list[0].device.brand} ${list[0].device.model}` : 'Appareil'}
                  {list[0].device?.photos ? <span className="font-normal text-neutral-500"> · {list[0].device.photos} photo(s) déjà publiée(s)</span> : null}
                </p>
                <Link href={`/admin/device?id=${deviceId}`} className="text-xs text-gold shrink-0">
                  Fiche
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {list.map((c) => (
                  <CandidateCard
                    key={c.id}
                    c={c}
                    busy={busy}
                    onZoom={() => setZoom(c)}
                    onPublish={() => run(async () => void (await publishAiCandidate(c.id)))}
                    onReject={() => run(async () => void (await rejectAiCandidate(c.id)))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(null)}>
          <div className="max-w-lg w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            <PreviewImage id={zoom.id} size="full" alt={zoom.device?.model || 'Photo'} className="w-full rounded-2xl bg-white" />
            <p className="text-xs text-neutral-300">
              {zoom.verdict.reason} · source :{' '}
              <a href={zoom.pageUrl || zoom.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-gold underline">
                {zoom.source}
              </a>
            </p>
            <button onClick={() => setZoom(null)} className="h-10 px-4 rounded-xl border border-neutral-700 text-white text-sm">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({ job, selected, onSelect, onCancel }: { job: AiJob; selected: boolean; onSelect: () => void; onCancel: () => void }) {
  const pct = job.total ? Math.round((job.processed / job.total) * 100) : 0;
  const live = job.status === 'running' || job.status === 'queued';
  const label: Record<AiJob['status'], string> = { queued: 'En attente', running: 'En cours', done: 'Terminée', cancelled: 'Arrêtée', failed: 'Interrompue' };
  return (
    <div className={cn('rounded-2xl border p-3 space-y-2 cursor-pointer', selected ? 'border-gold bg-gold/5' : 'border-neutral-800 bg-neutral-950')} onClick={onSelect}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-white truncate">{job.label || 'Recherche'}</p>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', live ? 'bg-gold/15 text-gold-soft' : job.status === 'done' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
          {live && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}
          {label[job.status]}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-gold to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-neutral-400">
        {job.processed}/{job.total} appareils · {job.found} photo(s) trouvée(s){job.auto ? ` · ${job.published} publiée(s) auto (≥ ${job.minScore})` : ''}
        {job.notFound ? ` · ${job.notFound} sans résultat` : ''}
        {job.errors ? ` · ${job.errors} erreur(s)` : ''}
      </p>
      {job.lastError && job.status === 'failed' && <p className="text-[11px] text-red-400">{job.lastError}</p>}
      {live && (
        <button onClick={(e) => (e.stopPropagation(), onCancel())} className="h-8 px-3 rounded-lg border border-neutral-700 text-[11px] text-neutral-300 flex items-center gap-1">
          <CircleStop className="w-3.5 h-3.5" /> Arrêter
        </button>
      )}
    </div>
  );
}

function CandidateCard({ c, busy, onZoom, onPublish, onReject }: { c: AiCandidate; busy: boolean; onZoom: () => void; onPublish: () => void; onReject: () => void }) {
  const tone = c.score >= 90 ? 'bg-emerald-500 text-white' : c.score >= 75 ? 'bg-gold text-ink' : 'bg-amber-500 text-black';
  return (
    <div className="rounded-2xl border border-neutral-800 overflow-hidden flex flex-col">
      <button onClick={onZoom} className="theme-fixed relative bg-white" aria-label="Agrandir">
        <PreviewImage id={c.id} size="thumb" alt={c.device?.model || 'Photo'} className="w-full aspect-square object-contain" />
        <span className={cn('absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[11px] font-black', tone)}>{c.score}</span>
      </button>
      <div className="p-2 space-y-1.5 flex-1 flex flex-col">
        <p className="text-[11px] font-semibold text-white truncate">{c.color || 'Tous coloris'}</p>
        <p className="text-[10px] text-neutral-500 line-clamp-2 flex-1" title={c.verdict.reason}>
          {c.verdict.reason}
        </p>
        <a href={c.pageUrl || c.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-[10px] text-neutral-400 hover:text-gold flex items-center gap-1 truncate">
          <ExternalLink className="w-3 h-3 shrink-0" /> {c.source}
        </a>
        {c.error && <p className="text-[10px] text-red-400">{c.error}</p>}
        <div className="flex gap-1.5">
          <button disabled={busy} onClick={onPublish} className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
            <Check className="w-3.5 h-3.5" /> Publier
          </button>
          <button disabled={busy} onClick={onReject} className="h-8 w-8 rounded-lg border border-neutral-700 text-neutral-400 hover:text-red-400 flex items-center justify-center disabled:opacity-50" aria-label="Rejeter">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Aperçu chargé avec le jeton admin (les propositions ne sont pas publiques) */
function PreviewImage({ id, size, alt, className }: { id: string; size: 'thumb' | 'full'; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    fetchAiPreview(id, size)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (alive) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className={className} /> : <div className={cn(className, 'animate-pulse bg-neutral-200')} />;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('h-8 px-3 rounded-full border text-xs font-semibold', on ? 'bg-gold/15 border-gold text-gold-soft' : 'bg-neutral-900 border-neutral-800 text-neutral-400')}>
      {children}
    </button>
  );
}

function Mode({ on, onClick, title, text }: { on: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn('flex-1 min-w-[220px] text-left rounded-2xl border p-3', on ? 'border-gold bg-gold/10' : 'border-neutral-800 bg-neutral-900/50')}>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-[11px] text-neutral-400">{text}</p>
    </button>
  );
}
