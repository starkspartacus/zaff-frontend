import type { MetadataRoute } from 'next';

/** Installation sur l'écran d'accueil (indispensable pour les notifications push sur iPhone) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZAFF — Stock & Caisse',
    short_name: 'ZAFF',
    description: 'Stock au N° de série, vente par scan et suivi en temps réel de votre boutique.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'fr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
