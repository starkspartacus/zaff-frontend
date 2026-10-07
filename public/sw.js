/* ZAFF — service worker des notifications push (ventes, stock bas, clôtures de caisse). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'ZAFF', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Application ouverte et visible : le toast temps réel s'affiche déjà, pas de doublon
      if (windows.some((w) => w.visibilityState === 'visible')) return;
      return self.registration.showNotification(data.title || 'ZAFF', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        tag: data.tag || 'zaff',
        renotify: true,
        requireInteraction: data.level === 'warning' || data.level === 'error',
        vibrate: [80, 40, 80],
        data: { url: data.url || '/app' },
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/app', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => w.url.startsWith(self.location.origin));
      if (existing) return existing.focus().then((w) => w && w.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});
