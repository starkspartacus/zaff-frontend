import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('zaff_token');
    const tenantSlug = localStorage.getItem('zaff_tenant_slug');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (tenantSlug) {
      config.headers['x-tenant-slug'] = tenantSlug;
    }
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
        ['zaff_token', 'zaff_user', 'zaff_establishment', 'zaff_tenant_slug'].forEach((k) =>
          localStorage.removeItem(k)
        );
        window.location.href = '/login';
      }
    }
    const message = error.response?.data?.message || error.message || 'Une erreur est survenue';
    return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
  }
);
