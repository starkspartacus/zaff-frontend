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

/**
 * Envoi d'une photo déjà réduite. Appelé **uniquement au moment d'enregistrer** (fiche produit) ou
 * d'importer (photothèque) : choisir une photo ne l'envoie pas, aucun fichier n'est laissé sans produit.
 */
export async function uploadImageBlob(
  image: PreparedImage,
  meta: { brand: string; model: string; color?: string; category?: string },
  opts: { library?: boolean } = {}
) {
  const ext = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'jpg');
  const form = new FormData();
  form.append('file', image.blob, `photo.${ext(image.blob)}`);
  form.append('thumb', image.thumb, `vignette.${ext(image.thumb)}`);
  for (const [k, v] of Object.entries(meta)) if (v) form.append(k, v);
  if (opts.library) form.append('library', 'true');
  return (await api.post('/global/images', form, { headers: { 'Content-Type': 'multipart/form-data' } })) as unknown as SharedImage & {
    duplicate: boolean;
  };
}

/** Annule une photo envoyée dont le produit n'a pas pu être enregistré (sinon supprimée par le serveur au bout d'1 h) */
export const discardImage = (id: string) => api.delete(`/global/images/${id}/pending`).catch(() => undefined);

/** Photothèque de ma boutique (propriétaire) */
export const useMyLibrary = (enabled = true) =>
  useQuery({
    queryKey: ['images', 'mine'],
    queryFn: () => api.get('/global/images/mine') as unknown as Promise<SharedImage[]>,
    enabled,
  });

export const deleteLibraryImage = (id: string) => api.delete(`/global/images/${id}`);

/** Signaler une photo d'une autre boutique (inadaptée, mauvais modèle) */
export const reportImage = (id: string) => api.post(`/global/images/${id}/report`) as unknown as Promise<{ reported: boolean; hidden: boolean }>;

export interface ImageUsage {
  storage: 'uploadthing' | 'database';
  shared: { photos: number; bytes: number; hidden: number };
  mine: { photos: number; bytes: number; library: number };
  provider: { totalBytes: number; limitBytes: number; filesUploaded: number } | null;
}

export const useImageUsage = (enabled = true) =>
  useQuery({ queryKey: ['images', 'usage'], queryFn: () => api.get('/global/images/usage') as unknown as Promise<ImageUsage>, enabled });

export const formatBytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} Go` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;
