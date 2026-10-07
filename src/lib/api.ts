import axios from 'axios';
import { env } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';

export const API_BASE_URL = env.NEXT_PUBLIC_API_URL;

/** Erreur API avec un message lisible et les détails éventuels du serveur */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const { token, establishment } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (establishment?.slug) {
    config.headers['x-tenant-slug'] = establishment.slug;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Si l'API NestJS renvoie le format { success: true, data: ... }
    if (response.data && response.data.data !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/app')) {
        useAuthStore.getState().clear();
        window.location.href = '/login';
      }
    }
    const message = error.response?.data?.message || error.message || 'Une erreur est survenue';
    return Promise.reject(
      new ApiError(Array.isArray(message) ? message.join(', ') : message, error.response?.status, error.response?.data?.details)
    );
  }
);
