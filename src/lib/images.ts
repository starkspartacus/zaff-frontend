'use client';

import { useQuery } from '@tanstack/react-query';
import { api, API_BASE_URL } from '@/lib/api';

/** Photo de la base d'images partagée (toutes boutiques) */
export interface SharedImage {
  id: string;
  category: string | null;
  brand: string;
  model: string;
  color: string | null;
  bytes: number;
  establishmentName: string | null;
  usage: number;
  library?: boolean;
  pending?: boolean;
  createdAt?: string;
  hidden?: boolean;
  reports?: number;
  hasThumb?: boolean;
  url: string;
}

export type ImageSize = 'full' | 'thumb';

/** Adresse publique du fichier (balise <img>, mise en cache par le navigateur) */
export const imageUrl = (id?: string | null, size: ImageSize = 'full') =>
  id ? `${API_BASE_URL}/global/images/${id}/file${size === 'thumb' ? '?size=thumb' : ''}` : null;

export const useSharedImages = (q: { brand?: string; model?: string; color?: string; category?: string }) =>
  useQuery({
    queryKey: ['images', q.brand || '', q.model || '', q.color || '', q.category || ''],
    queryFn: () => api.get('/global/images', { params: q }) as unknown as Promise<SharedImage[]>,
    enabled: !!(q.brand && q.model),
    staleTime: 60 * 1000,
  });

/**
 * Réduit la photo dans le navigateur avant l'envoi (≤ 1000 px, WebP ou JPEG ≈ 100–250 Ko) :
 * rapide même en 3G, et léger pour la base partagée.
 */
export async function shrinkImage(file: Blob, max = 1000, maxBytes = 550 * 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Cette image ne peut pas être lue. Essayez une photo JPEG ou PNG.");
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Votre navigateur ne permet pas de préparer la photo.");
  ctx.fillStyle = '#ffffff'; // fond blanc pour les PNG transparents
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const toBlob = (type: string, quality: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  for (const [type, quality] of [['image/webp', 0.82], ['image/jpeg', 0.82], ['image/jpeg', 0.65], ['image/jpeg', 0.5]] as const) {
    const blob = await toBlob(type, quality);
    if (blob && blob.type === type && blob.size <= maxBytes) return blob;
  }
  throw new Error('Photo trop lourde, même réduite. Essayez une autre photo.');
}

/** Photo prête à envoyer : version ≤ 1000 px et vignette ≈ 320 px (cartes de la Vitrine, listes) */
export interface PreparedImage {
  blob: Blob;
  thumb: Blob;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const blob = await shrinkImage(file);
  const thumb = await shrinkImage(blob, 320, 75 * 1024);
  return { blob, thumb };
}

/** Signaler une photo d'une autre boutique (inadaptée, mauvais modèle) */
export const reportImage = (id: string) => api.post(`/global/images/${id}/report`) as unknown as Promise<{ reported: boolean; hidden: boolean }>;

export interface ImageUsage {
  storage: 'uploadthing' | 'database';
  shared: { photos: number; bytes: number; hidden: number };
  mine: { photos: number; bytes: number; library: number };
  provider: { totalBytes: number; limitBytes: number; filesUploaded: number } | null;
}

export const formatBytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} Go` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;

/**
 * Photo prise par la boutique pour son produit : envoyée au moment d'enregistrer le produit,
 * visible par cette boutique seulement. Renvoie l'identifiant de la photo.
 */
export async function uploadShopImage(img: PreparedImage, meta: { brand: string; model: string; color?: string; category?: string }) {
  const form = new FormData();
  form.append('file', img.blob, 'photo.' + (img.blob.type === 'image/webp' ? 'webp' : 'jpg'));
  form.append('thumb', img.thumb, 'vignette.' + (img.thumb.type === 'image/webp' ? 'webp' : 'jpg'));
  form.append('brand', meta.brand);
  form.append('model', meta.model);
  if (meta.color) form.append('color', meta.color);
  if (meta.category) form.append('category', meta.category);
  const res = (await api.post('/global/images/shop', form, { headers: { 'Content-Type': 'multipart/form-data' } })) as unknown as SharedImage;
  return res.id;
}

/** Produit pas enregistré : la photo envoyée juste avant est effacée (aucun fichier orphelin) */
export const discardShopImage = (id: string) => api.delete(`/global/images/${id}/pending`).catch(() => undefined);

/** Résultat du studio photo : photo recadrée et mise au format par le serveur (IA si disponible) */
export interface StudioPhoto extends PreparedImage {
  steps: string[];
  tips: string[];
  ai: { used: boolean; cropped: boolean; matches: boolean | null; device: string | null };
  /** Photo d'origine (pour comparer « avant / après ») */
  original: Blob;
  /** false : optimisation indisponible, photo seulement réduite dans le navigateur */
  optimized: boolean;
}

const b64ToBlob = (b64: string, type: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
};

/**
 * Studio photo : la photo (réduite à 1600 px pour aller vite en 3G) est envoyée au serveur, qui la recadre sur l'appareil,
 * la corrige et la met au format du catalogue. Rien n'est enregistré à ce moment-là. En cas d'échec : simple réduction locale.
 */
export async function studioPhoto(file: File, meta: { brand?: string; model?: string; color?: string }): Promise<StudioPhoto> {
  const original = await shrinkImage(file, 1600, 1500 * 1024);
  try {
    const form = new FormData();
    form.append('file', original, 'photo.' + (original.type === 'image/webp' ? 'webp' : 'jpg'));
    if (meta.brand) form.append('brand', meta.brand);
    if (meta.model) form.append('model', meta.model);
    if (meta.color) form.append('color', meta.color);
    const r = (await api.post('/global/images/shop/prepare', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 })) as unknown as {
      full: string;
      thumb: string;
      mime: string;
      steps: string[];
      tips: string[];
      ai: StudioPhoto['ai'];
    };
    return { blob: b64ToBlob(r.full, r.mime), thumb: b64ToBlob(r.thumb, r.mime), steps: r.steps, tips: r.tips, ai: r.ai, original, optimized: true };
  } catch (err) {
    // Photo refusée (pas une photo, trop petite) : le message du serveur est affiché
    if ((err as { status?: number })?.status === 400) throw err;
    const local = await prepareImage(file);
    return { ...local, steps: [], tips: ['Optimisation indisponible pour le moment : la photo sera envoyée simplement réduite.'], ai: { used: false, cropped: false, matches: null, device: null }, original, optimized: false };
  }
}
