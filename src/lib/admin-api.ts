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

export interface AdminDevice {
  id: string;
  category: string;
  brand: string;
  model: string;
  variants: string[];
  colors: string[];
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
}

export interface DeviceInput {
  category: string;
  brand: string;
  model: string;
  variants?: string[];
  colors?: string[];
  active?: boolean;
}

export const adminLogin = (email: string, password: string) =>
  adminApi.post('/platform/auth/login', { email, password }) as unknown as Promise<{ accessToken: string; admin: { email: string } }>;

export const useDeviceStats = () => useQuery({ queryKey: ['admin', 'stats'], queryFn: () => get<DeviceStats>('/platform/devices/stats') });

export const useAdminDevices = (q: { search?: string; category?: string; photos?: string; page?: number; limit?: number }) =>
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
