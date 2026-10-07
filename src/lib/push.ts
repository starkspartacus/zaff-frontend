'use client';

import { api } from '@/lib/api';

export type PushState =
  | 'unsupported' // navigateur sans Web Push
  | 'ios-install' // iPhone : installer l'app sur l'écran d'accueil d'abord
  | 'server-off' // clés VAPID non configurées côté serveur
  | 'denied' // notifications bloquées dans le navigateur
  | 'off'
  | 'on';

interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

const SW_URL = '/sw.js';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

const getConfig = () => api.get('/notifications/push/config') as unknown as Promise<PushConfig>;

async function registration() {
  return (await navigator.serviceWorker.getRegistration(SW_URL)) || navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' });
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  const config = await getConfig().catch(() => null);
  if (!config?.enabled) return 'server-off';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

/** Active les notifications sur cet appareil (demande l'autorisation au navigateur) */
export async function enablePush(): Promise<PushState> {
  const config = await getConfig();
  if (!config.enabled || !config.publicKey) return 'server-off';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.publicKey) }));
  const json = sub.toJSON();
  await api.post('/notifications/push/subscribe', {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    userAgent: navigator.userAgent.slice(0, 300),
  });
  return 'on';
}

/** Désactive les notifications sur cet appareil (aussi appelé à la déconnexion) */
export async function disablePush(): Promise<PushState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return 'off';
}
