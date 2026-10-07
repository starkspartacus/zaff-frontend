# ZAFF — Architecture et conventions (frontend)

> Mémoire du projet : à lire avant toute modification. À mettre à jour quand une règle change.
> Backend : voir `zaff-backend/docs/ARCHITECTURE.md` (bases globale / par boutique, rôles, temps réel).

## Produit et UX
ERP + caisse pour boutiques high-tech. Stock **à l'unité par N° de série / IMEI**, vente **par scan**,
suivi **en temps réel** par le propriétaire. Interface en français, pensée mobile d'abord (vendeur et
magasinier au téléphone, une main) : peu d'écrans, gros boutons, confirmation claire de chaque action,
messages d'erreur compréhensibles. Thème noir / or (`#d4a017`, `#f5d77f`).

## Pile technique
- **Next.js 16 (App Router)** — lire `node_modules/next/dist/docs/` avant d'utiliser une API Next (cf. AGENTS.md).
- **React Query** (`@tanstack/react-query`) : toutes les lectures serveur des écrans principaux.
  Clés dans `src/lib/query-keys.ts`, hooks dans `src/lib/queries.ts`.
  Le 1er segment d'une clé = un *scope* serveur (`products`, `units`, `sales`, `dashboard`, `my-stats`, …).
- **WebSocket** (`socket.io-client`, `src/lib/realtime.ts`) : une connexion par onglet, ouverte par
  `RealtimeBridge` (`src/components/providers.tsx`) tant qu'une session existe.
  - `notification` → store de notifications (toast + cloche).
  - `data:invalidate { scopes }` → `invalidateQueries([scope])` regroupés sur 250 ms : seules les requêtes
    affichées sont rechargées. **Ne pas ajouter de polling** : le temps réel s'en charge.
  - reconnexion → invalidation globale (rattrapage) ; `presence` → collaborateurs en ligne (propriétaire).
- **Zustand** (`src/stores/`) : `auth-store` (session persistée `zaff-auth`, lue hors React par le client
  API et le WebSocket), `notification-store` (notifications, toasts, présence, statut de connexion).
  `useAuth()` (`src/contexts/auth-context.tsx`) expose la session + login / logout à partir du store.
- **Zod** (`src/lib/schemas.ts`, `src/lib/env.ts`) : formulaires (connexion, nouveau modèle, collaborateur),
  variables d'environnement, et **validation de tout message temps réel** avant de l'utiliser.
- **UI** : Sera UI (`src/components/seraui/`, https://seraui.com/docs) et Magic UI (`src/components/magicui/`,
  https://magicui.design) — AnimatedList (notifications), NumberTicker (chiffres), BlurFade (apparitions),
  BorderBeam (carte à confirmer), AnimatedShinyText (« En direct »). shadcn/Base UI pour les primitives.
  Respecter `prefers-reduced-motion` (règle globale dans `globals.css`).

## Rôles et navigation (`src/lib/roles.ts`)
`admin` (propriétaire, tout) · `seller` (vendeur → `/app/scan`) · `storekeeper` (magasinier → `/app/receive`).
`canAccess(role, path)` filtre le menu et `app/app/layout.tsx` redirige hors périmètre. Le serveur applique
de toute façon les permissions : ne jamais s'y fier côté client seul.

## Écrans clés
- `/app/scan` vendeur : scan → fiche → « Voulez-vous vendre cet article ? » → Oui → écran « Vendu ! ».
- `/app/receive` magasinier : choisir / créer le modèle (suggestions du catalogue de référence global),
  puis scanner chaque appareil (✓ / ✗ avec la raison, annulation possible).
- `/app/my-activity` : mes ventes / mes mises en stock. `/app` propriétaire : chiffres du jour, ventes par
  vendeur, équipe en ligne (temps réel).
- `/app/cash-closing` vendeur (et propriétaire qui vend) : ma caisse en cours (espèces / Mobile Money à remettre),
  comptage des espèces avec écart en direct, explication obligatoire s'il y a un écart, confirmation, historique.
- `/app/cash-closings` propriétaire : espèces encore chez les vendeurs, clôtures à valider (« J'ai reçu… »),
  caisses ouvertes par vendeur, historique. Tout se met à jour par le WebSocket (scope `cash-closings`).
- `src/components/scan/barcode-scanner.tsx` : caméra (ZXing, HTTPS requis sur mobile) + douchette / clavier.

## Notifications push (application fermée)
- `public/sw.js` : affiche la notification reçue **sauf si l'app est visible** (le toast temps réel suffit),
  ouvre la bonne page au clic. Servi sans cache (`next.config.ts`). `src/app/manifest.ts` + icônes `public/icon-*.png`
  (installation sur l'écran d'accueil, indispensable pour le push sur iPhone).
- `src/lib/push.ts` : état / activation / désactivation (clé publique VAPID fournie par l'API). Interrupteur dans la
  cloche (`PushToggle`), bandeau d'invitation sur l'accueil du propriétaire (`PushPrompt`). La déconnexion désabonne
  l'appareil. HTTPS obligatoire en production.

## Conventions
- Appels API via `api` (`src/lib/api.ts`) : réponse déjà « déballée » (`data`), erreurs `ApiError` (message
  lisible + `details`). Types partagés dans `src/lib/types.ts`, `errorMessage(err)` pour l'affichage.
- Pas de `any` dans le nouveau code (le lint en compte encore dans les anciennes pages).
- Écritures : mutations React Query qui invalident localement les scopes touchés (les autres écrans sont
  prévenus par le WebSocket).

## Vérifier un changement
`npx tsc --noEmit` · `npx eslint` (ne pas dépasser le nombre d'erreurs existant) · `npm run build`.
Test navigateur : faux backend REST + Socket.IO et Playwright (Chromium `/opt/pw-browsers`) — connexion,
toast de vente, invalidation du dashboard, cloche, persistance de session, mobile.
