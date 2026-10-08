'use client';

import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, ApiError } from '@/lib/api';
import { useAdminStore } from '@/stores/admin-store';
import type { PreparedImage, SharedImage } from '@/lib/images';
import type { DeviceCatalog, ReferenceCategory } from '@/lib/queries';

/** Client API de l'espace administrateur (jeton admin, jamais celui d'une boutique) */
export const adminApi = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });

adminApi.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (response) => (response.data && response.data.data !== undefined ? response.data.data : response.data),
  (error) => {
    const status = error.response?.status;
    if ((status === 401 || status === 403) && typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      useAdminStore.getState().clear();
      window.location.href = '/admin/login';
    }
    const message = error.response?.data?.message || error.message || 'Une erreur est survenue';
    return Promise.reject(new ApiError(Array.isArray(message) ? message.join(', ') : message, status, error.response?.data?.details));
  }
);

const get = <T,>(url: string, params?: Record<string, unknown>) => adminApi.get(url, { params }) as unknown as Promise<T>;

export interface DeviceSpec {
  label: string;
  value: string;
}

export interface AdminDevice {
  id: string;
  category: string;
  brand: string;
  model: string;
  variants: string[];
  colors: string[];
  specs: DeviceSpec[];
  /** Nombre de boutiques qui ont ce modèle en catalogue */
  shops: number;
  /** Prix pratiqués (médiane d'au moins 3 boutiques) */
  prices: { currency: string; variant: string | null; median: number; shops: number }[];
  /** Nombre d'autres écritures fusionnées (doublons) */
  aliases: number;
  photos: { imageId: string; color: string | null }[];
  imageId: string | null;
  active: boolean;
  updatedAt: string | null;
}

export interface DeviceStats {
  devices: number;
  active: number;
  withPhotos: number;
  missingPhotos: number;
  photos: number;
  brands: number;
  reported: number;
  /** Appareils présents dans au moins une boutique, et parmi eux ceux qui ont une photo */
  usedDevices: number;
  usedWithPhotos: number;
  /** Demandes d'ajout ouvertes */
  requests: number;
}

export type RequestStatus = 'open' | 'added' | 'dismissed';

/** Modèle saisi par des boutiques, absent du catalogue */
export interface DeviceRequest {
  id: string;
  category: string | null;
  brand: string;
  model: string;
  colors: string[];
  variants: string[];
  shops: number;
  status: RequestStatus;
  deviceId: string | null;
  lastSeenAt: string | null;
}

export interface DeviceInput {
  category: string;
  brand: string;
  model: string;
  variants?: string[];
  colors?: string[];
  specs?: DeviceSpec[];
  active?: boolean;
}

export const adminLogin = (email: string, password: string) =>
  adminApi.post('/platform/auth/login', { email, password }) as unknown as Promise<{ accessToken: string; admin: { email: string } }>;

export const useDeviceStats = (enabled = true) => useQuery({ queryKey: ['admin', 'stats'], queryFn: () => get<DeviceStats>('/platform/devices/stats'), enabled });

export const useAdminDevices = (q: { search?: string; category?: string; photos?: string; sort?: 'name' | 'popular'; page?: number; limit?: number }) =>
  useQuery({
    queryKey: ['admin', 'devices', q],
    queryFn: () => get<{ total: number; page: number; limit: number; items: AdminDevice[] }>('/platform/devices', q),
    placeholderData: (prev) => prev,
  });

export const useAdminDevice = (id: string | null) =>
  useQuery({ queryKey: ['admin', 'device', id], queryFn: () => get<AdminDevice>(`/platform/devices/${id}`), enabled: !!id });

/** Catalogue tel que le voient les boutiques (sert à reconnaître les appareils à l'import) */
export const useAdminCatalog = () =>
  useQuery({ queryKey: ['admin', 'catalog'], queryFn: () => get<DeviceCatalog>('/global/reference/devices'), staleTime: 60 * 1000 });

/** Catégories de référence (lues avec le jeton admin) */
export const useAdminCategories = () =>
  useQuery({ queryKey: ['admin', 'categories'], queryFn: () => get<ReferenceCategory[]>('/global/reference/catalog'), staleTime: 10 * 60 * 1000 });

export const useReportedPhotos = () => useQuery({ queryKey: ['admin', 'reports'], queryFn: () => get<SharedImage[]>('/platform/devices/reports') });

export const useAdminUsage = () =>
  useQuery({
    queryKey: ['admin', 'usage'],
    queryFn: () =>
      get<{ storage: 'uploadthing' | 'database'; shared: { photos: number; bytes: number; hidden: number }; provider: { totalBytes: number; limitBytes: number } | null }>(
        '/platform/devices/usage'
      ),
  });

export const useDeviceRequests = (status: RequestStatus) =>
  useQuery({ queryKey: ['admin', 'requests', status], queryFn: () => get<DeviceRequest[]>('/platform/device-requests', { status }) });

export const acceptRequest = (id: string, dto: DeviceInput) =>
  adminApi.post(`/platform/device-requests/${id}/accept`, dto) as unknown as Promise<{ device: AdminDevice; linked: number }>;
export const mergeRequest = (id: string, deviceId: string) =>
  adminApi.post(`/platform/device-requests/${id}/merge`, { deviceId }) as unknown as Promise<{ device: AdminDevice; linked: number }>;
export const dismissRequest = (id: string) => adminApi.post(`/platform/device-requests/${id}/dismiss`);
export const reopenRequest = (id: string) => adminApi.post(`/platform/device-requests/${id}/reopen`);

/** Recalcul : boutiques par appareil, demandes d'ajout, photos transmises aux produits */
export const syncCatalog = () =>
  adminApi.post('/platform/devices/sync') as unknown as Promise<{ shops: number; products: number; devicesUsed: number; requests: number } | null>;

// ─── Photos par l'IA ───

export interface AiStatus {
  enabled: boolean;
  model: string;
}

export interface AiJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'cancelled' | 'failed';
  label: string | null;
  total: number;
  processed: number;
  found: number;
  published: number;
  notFound: number;
  errors: number;
  auto: boolean;
  minScore: number;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface AiCandidate {
  id: string;
  jobId: string;
  deviceId: string;
  device: { brand: string; model: string; category: string; photos: number } | null;
  color: string | null;
  score: number;
  verdict: { view?: string; cleanBackground?: boolean; textOrWatermark?: boolean; reason?: string };
  source: string | null;
  sourceUrl: string;
  pageUrl: string | null;
  bytes: number;
  status: 'pending' | 'published' | 'rejected' | 'failed';
  error: string | null;
}

export const useAiStatus = () => useQuery({ queryKey: ['admin', 'ai', 'status'], queryFn: () => get<AiStatus>('/platform/ai-images/status') });

/** Lots de recherche : rechargés toutes les 3 s tant qu'un lot est en cours (l'espace admin n'a pas de WebSocket) */
export const useAiJobs = () =>
  useQuery({
    queryKey: ['admin', 'ai', 'jobs'],
    queryFn: () => get<AiJob[]>('/platform/ai-images/jobs'),
    refetchInterval: (q) => ((q.state.data as AiJob[] | undefined)?.some((j) => j.status === 'running' || j.status === 'queued') ? 3000 : false),
  });

export const useAiCandidates = (q: { status?: string; jobId?: string }, live = false) =>
  useQuery({
    queryKey: ['admin', 'ai', 'candidates', q],
    queryFn: () => get<AiCandidate[]>('/platform/ai-images/candidates', q),
    refetchInterval: live ? 4000 : false,
  });

export const createAiJob = (body: { deviceIds?: string[]; selection?: 'missing-popular'; limit?: number; auto?: boolean; minScore?: number }) =>
  adminApi.post('/platform/ai-images/jobs', body) as unknown as Promise<AiJob>;
export const cancelAiJob = (id: string) => adminApi.post(`/platform/ai-images/jobs/${id}/cancel`);
export const publishAiCandidate = (id: string, color?: string | null) => adminApi.post(`/platform/ai-images/candidates/${id}/publish`, color === undefined ? {} : { color });
export const rejectAiCandidate = (id: string) => adminApi.post(`/platform/ai-images/candidates/${id}/reject`);
export const publishAiCandidates = (body: { ids?: string[]; jobId?: string; minScore?: number }) =>
  adminApi.post('/platform/ai-images/candidates/publish', body) as unknown as Promise<{ published: number; failed: number }>;
/** Aperçu protégé (jeton admin) : chargé en blob */
export const fetchAiPreview = (id: string, size: 'thumb' | 'full') =>
  adminApi.get(`/platform/ai-images/candidates/${id}/preview`, { params: { size }, responseType: 'blob' }) as unknown as Promise<Blob>;

export const createDevice = (dto: DeviceInput) => adminApi.post('/platform/devices', dto) as unknown as Promise<AdminDevice>;
export const updateDevice = (id: string, dto: Partial<DeviceInput>) => adminApi.put(`/platform/devices/${id}`, dto) as unknown as Promise<AdminDevice>;
export const deleteDevice = (id: string) => adminApi.delete(`/platform/devices/${id}`);
export const setDefaultPhoto = (id: string, imageId: string) => adminApi.patch(`/platform/devices/${id}/photos/${imageId}/default`) as unknown as Promise<AdminDevice>;
export const removeDevicePhoto = (id: string, imageId: string) => adminApi.delete(`/platform/devices/${id}/photos/${imageId}`);
export const keepReportedPhoto = (imageId: string) => adminApi.post(`/platform/devices/reports/${imageId}/keep`);
export const removeReportedPhoto = (imageId: string) => adminApi.delete(`/platform/devices/reports/${imageId}`);

/** Envoi d'une photo conforme (photo + vignette déjà réduites dans le navigateur) */
export async function uploadDevicePhoto(deviceId: string, image: PreparedImage, color?: string | null) {
  const ext = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'jpg');
  const form = new FormData();
  form.append('file', image.blob, `photo.${ext(image.blob)}`);
  form.append('thumb', image.thumb, `vignette.${ext(image.thumb)}`);
  if (color) form.append('color', color);
  return (await adminApi.post(`/platform/devices/${deviceId}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } })) as unknown as {
    device: AdminDevice;
    image: SharedImage & { duplicate: boolean };
  };
}

/** Recharge les données admin (et le catalogue vu par les boutiques) après une modification */
export function useAdminRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['admin'] });
}

export function useDeviceMutation<T>(fn: (v: T) => Promise<unknown>) {
  const refresh = useAdminRefresh();
  return useMutation({ mutationFn: fn, onSuccess: () => refresh() });
}
