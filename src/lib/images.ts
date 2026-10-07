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
  url: string;
}

/** Adresse publique du fichier (balise <img>, mise en cache par le navigateur) */
export const imageUrl = (id?: string | null) => (id ? `${API_BASE_URL}/global/images/${id}/file` : null);

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
export async function shrinkImage(file: File, max = 1000): Promise<Blob> {
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
  for (const [type, quality] of [['image/webp', 0.82], ['image/jpeg', 0.82], ['image/jpeg', 0.65]] as const) {
    const blob = await toBlob(type, quality);
    if (blob && blob.type === type && blob.size <= 550 * 1024) return blob;
  }
  throw new Error('Photo trop lourde, même réduite. Essayez une autre photo.');
}

/**
 * Envoi d'une photo déjà réduite. Appelé **uniquement au moment d'enregistrer** (fiche produit) ou
 * d'importer (photothèque) : choisir une photo ne l'envoie pas, aucun fichier n'est laissé sans produit.
 */
export async function uploadImageBlob(
  blob: Blob,
  meta: { brand: string; model: string; color?: string; category?: string },
  opts: { library?: boolean } = {}
) {
  const form = new FormData();
  form.append('file', blob, blob.type === 'image/webp' ? 'photo.webp' : 'photo.jpg');
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
