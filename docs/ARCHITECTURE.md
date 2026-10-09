# ZAFF — Architecture et conventions (frontend)

> Mémoire du projet : à lire avant toute modification. À mettre à jour quand une règle change.
> Backend : voir `zaff-backend/docs/ARCHITECTURE.md` (bases globale / par boutique, rôles, temps réel).

## Produit et UX
ERP + caisse pour boutiques high-tech. Stock **à l'unité par N° de série / IMEI**, vente **par scan**,
suivi **en temps réel** par le propriétaire. Interface en français, pensée mobile d'abord (vendeur et
magasinier au téléphone, une main) : peu d'écrans, gros boutons, confirmation claire de chaque action,
messages d'erreur compréhensibles. Couleurs de marque or : jetons `gold`, `gold-soft`, `gold-deep`, `gold-ink`, `ink`
(`globals.css`) — **ne plus écrire `[#d4a017]` ni `text-black`** dans les classes, sinon le thème clair ne s'applique pas.

## Thèmes clair / sombre
- **Clair par défaut dans l'application** (`/app`), sombre au choix : bouton soleil / lune dans l'en-tête (`ThemeToggle`),
  mémorisé sur l'appareil (`stores/theme-store.ts`, clé `zaff-theme`). `app/app/layout.tsx` pose `data-theme` sur `<html>` ;
  les pages publiques (accueil, connexion, inscription, `/verify`, `/contract`) gardent leur style.
- Les écrans sont écrits en classes « sombres » (`bg-black`, `bg-neutral-950`, `text-white`…) : le thème clair **inverse la
  palette par variables CSS** (`html.dark[data-theme="light"]` dans `globals.css`) — fond crème, cartes blanches, couleurs
  d'état assombries pour rester lisibles, halo doré (`.app-main`). Écrire les nouveaux écrans de la même façon.
- `.theme-fixed` : garde les couleurs d'origine (papier du contrat, photos produits, pastilles sur image).

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
  puis scanner chaque appareil (✓ / ✗ avec la raison, annulation possible). `?product=<id>` : modèle déjà choisi
  (bouton « Mettre en stock » du Catalogue, « Scanner les appareils » de la fiche produit, et automatiquement après la
  création d'un produit à N° de série dans le Catalogue).
- **Le stock d'un produit à N° de série ne monte qu'en scannant le N° de série / IMEI de chaque appareil** ; le code-barres
  de la boîte identifie seulement le modèle (rappelé dans la fiche produit et la fenêtre de scan du code-barres).
- `/app/catalog` lit les produits avec React Query (`useProducts`) : stock rafraîchi en direct par le WebSocket.
  Ne jamais charger une liste avec un `api.get` ponctuel dans un `useEffect` (elle ne se met plus à jour).
- `/app/my-activity` : mes ventes / mes mises en stock. `/app` propriétaire : chiffres du jour, ventes par
  vendeur, équipe en ligne (temps réel).
- `/app/cash-closing` vendeur (et propriétaire qui vend) : ma caisse en cours (espèces / Mobile Money à remettre),
  comptage des espèces avec écart en direct, explication obligatoire s'il y a un écart, confirmation, historique.
- `/app/cash-closings` propriétaire : espèces encore chez les vendeurs, clôtures à valider (« J'ai reçu… »),
  caisses ouvertes par vendeur, historique. Tout se met à jour par le WebSocket (scope `cash-closings`).
- `/app/returns` vendeur / propriétaire : scan de l'appareil rapporté → motif (changement d'avis / panne) →
  vérifications (conditions de la boutique) ou description de la panne → **seules les solutions autorisées par la
  politique de la boutique** (échange, avoir, remboursement, réparation sous garantie / payante) → résultat (code
  d'avoir imprimable, montant à rendre, ticket SAV). Échange : « Scanner le nouvel appareil » ouvre
  `/app/scan?credit=AV-…` (lu avec `useSearchParams` sous `<Suspense>`), l'avoir est déduit du prix.
- `/app/settings` propriétaire : politique de retour et de garantie, avec le résumé « Ce que vos clients entendront ».
- `/register` : inscription en 4 étapes animées (Votre boutique → Adresse → Vous → Sécurité, frise horizontale
  sur mobile / verticale sur ordinateur). Pays / villes / communes / devises viennent de l'API (`/global/geo/*`,
  `src/lib/geo.ts`, cache infini) ; Abidjan → commune obligatoire ; e-mail obligatoire ; disponibilité du numéro
  et de l'e-mail vérifiée avant la dernière étape (`/global/establishments/check`) → modale « déjà un compte »
  (PHONE_TAKEN / EMAIL_TAKEN, aussi renvoyés par le serveur à l'inscription). Succès : confettis puis connexion auto.
- `/login` : onglets Téléphone | E-mail. Téléphone : pays d'abord (indicatif automatique, dernier pays mémorisé
  `zaff-last-country`), envoi `{ identifier, password, countryCode }`. Réponse `platform: true` (e-mail de l'administrateur
  ZAFF) → session admin (`admin-store`), session boutique effacée, redirection `/admin`. Lien « Espace administrateur ». Plus de champ « slug » : si le compte existe
  dans plusieurs boutiques, le serveur renvoie la liste et l'utilisateur choisit.
- Téléphones : `PhoneInput` (`src/components/forms/geo-fields.tsx`, libphonenumber-js) = indicatif + numéro mis en
  forme et vérifié pour le pays ; envoyés en E.164. Listes longues : `SearchSelect` (recherche sans accents, feuille en bas sur mobile).
- **Contrat de vente et garantie** : `/contract?sale=<id>` (hors du menu, pour imprimer en A4 ou enregistrer en PDF ;
  `ContractDocument` dans `src/components/contract/`). Ouvert depuis l'écran « Vendu ! » du scan, la caisse POS,
  les factures et « Mes ventes ». Bouton WhatsApp : message récapitulatif (facture, N° de série, fin de garantie) au
  numéro du client. Valeurs inconnues imprimées en pointillés (à compléter à la main), fiche de garantie détachable.
  Paramètres → onglet « Contrat client » (`ContractSettingsPanel`) : informations légales, modèle ZAFF ou personnalisé
  (articles activés / modifiés / déplacés / ajoutés, retour au texte d'origine), aperçu avec une vente fictive.
  **QR code de vérification** sur chaque fiche de garantie (`QrCode`, lib `qrcode`, SVG) → page publique `/verify?c=…`
  (sans connexion) : garantie active / terminée / appareil rapporté, en réparation, appareil, boutique — aucune donnée
  client. Le lien est aussi dans le message WhatsApp. Adresse imprimée : `NEXT_PUBLIC_APP_URL` (sinon l'adresse courante).
- **Fiche produit** `ProductForm` (`src/components/products/`), partagée par le Catalogue (création / modification) et
  la Mise en stock (`compact`) : sections numérotées 1 Type d'appareil → 2 Marque et modèle → 3 Version (capacité /
  configuration, couleur) → 4 Désignation et codes (désignation et SKU automatiques, modifiables) → 5 État et
  accessoires → 6 Prix (marge en direct) → 7 Stock. Suggestions en cascade depuis `GET /global/reference/devices`
  (`useDeviceCatalog`) + les produits déjà créés par la boutique ; toute valeur absente se tape (« Ajouter « … » »).
  Alerte doublon (« Utiliser ce produit »), validation Zod `ProductFormSchema`.
- **Images produits** : les boutiques **ne photographient plus** leurs produits. Section « Photo » de la fiche produit :
  photos officielles de l'appareil du catalogue global (la bonne couleur d'abord, choisie automatiquement), ou « Sans
  photo » ; bouton « Signaler » si une photo est inadaptée. Le produit enregistre `imageId` + `deviceId`. `ProductVisual`
  affiche la photo (vignette ou pleine taille), sinon une illustration colorée par catégorie.
- **Espace administrateur `/admin`** (hors `/app`, session séparée `stores/admin-store.ts` clé `zaff-admin`, client
  `src/lib/admin-api.ts` ; 401/403 → `/admin/login`). Connexion avec l'e-mail et le mot de passe de l'environnement du
  serveur. Pages : tableau de bord (appareils, couverture photo, stockage, appareils à photographier), Appareils (recherche,
  filtres, création `DeviceEditorModal`), fiche appareil `/admin/device?id=` (photos par coloris, photo par défaut ★,
  retrait, ajout préparé localement et envoyé seulement sur « Envoyer »), **Import de photos** en masse (`/admin/import` :
  appareil / couleur devinés depuis le nom du fichier `src/lib/photo-guess.ts`, appareil inconnu créé, 3 envois en parallèle,
  doublons « Déjà là »), Signalements (Garder / Retirer). **Priorités** : « Appareils à photographier » et le filtre « Les plus
  utilisés » classent par nombre de boutiques ; carte « Utilisés par les boutiques » (part qui a sa photo) ; bouton « Mettre à
  jour » (recalcul). **Demandes** `/admin/requests` (badge dans le menu) : modèles saisis par les boutiques, « Ajouter »
  ouvre `DeviceEditorModal` pré-rempli (`prefill` + `onSubmit`) puis « Ajouter ses photos » ; Ignorer / Remettre à traiter.
  **Fiche technique** dans `DeviceEditorModal` (lignes usuelles proposées selon la catégorie).
- **Photos par l'IA** `/admin/ai` : lancer une recherche (10 / 25 / 50 / 100 appareils sans photo, les plus utilisés
  d'abord), mode « Je valide chaque photo » ou « Publication automatique » (note minimale), suivi des lots (rechargé toutes
  les 3 s seulement pendant un traitement), photos à valider groupées par appareil (note, coloris, raison, source),
  Publier / Rejeter, « Publier tout ce qui est noté ≥ … » ; bandeau orange « Même gamme : génération à vérifier » / « Modèle à confirmer » (`verdict.modelMatch`), pastille « À défaut » (`verdict.fallback` : meilleure photo du bon modèle quand aucune n'est de qualité catalogue). Aperçus chargés avec le jeton admin (`fetchAiPreview`, blob).
  Bouton « Chercher avec l'IA » sur la fiche appareil. Pastilles des IA utilisées (vert / orange = quota atteint jusqu'à
  HH:MM) et du secours Wikimedia ; « Compléter les fiches avec l'IA » (coloris + codes couleur, capacités, fiche technique,
  10 → 100 fiches incomplètes) ; « Détail par appareil » de chaque lot (raison d'un « sans résultat ») ; fiche appareil :
  pastilles de couleur et bouton « Compléter la fiche » ; journal : nom de l'appareil = lien vers sa fiche, valeurs ajoutées
  affichées ; liste Appareils : filtre « À vérifier (IA) » + pastille « IA » ; fiche : bandeau violet « Fiche vérifiée » ; fiche produit boutique : pastilles des coloris officiels ; lot « En pause (quota gratuit) » avec l'heure de reprise ; crédit © des photos libres. Sans `GEMINI_API_KEY` côté serveur : explication à la place.
- Boutique : `DeviceSpecs` (`src/components/products/device-specs.tsx`) affiche la fiche technique dans la fiche produit
  (modèle reconnu) et la Vitrine (`useCatalogDevice(product.deviceId)`). Modèle absent du catalogue : le formulaire indique
  que ZAFF est prévenu ; la photo arrive ensuite toute seule (WebSocket `products`, notification `catalog.photo`).
  Catalogue relu toutes les 10 min. **Prix pratiqué** (section Prix) : médiane d'au moins 3 boutiques dans la devise
  de la boutique (`establishment.currencyCode`), la bonne capacité d'abord, bouton « Utiliser ce prix ». Contrat :
  ligne « Caractéristiques » (fiche technique). Admin : bouton « Doublon » dans les demandes (`mergeRequest`).
- `/app/showcase` **Vitrine** (vendeur, magasinier, propriétaire) : cartes `ProductCard` (photo, prix de vente, version,
  état, pastille de stock), recherche, filtres par catégorie, « En stock seulement ». Fiche : infos + appareils disponibles,
  « Vendre » ouvre `/app/scan?code=<N° de série>` (recherche automatique comme un scan). Photo aussi sur la fiche de vente
  du scan et dans le Catalogue.
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
Backend sans MongoDB pour tester l'interface : `npm run dev:memory` dans zaff-backend (vrai backend, base en mémoire).

`npx tsc --noEmit` · `npx eslint` (ne pas dépasser le nombre d'erreurs existant) · `npm run build`.
Test navigateur : faux backend REST + Socket.IO et Playwright (Chromium `/opt/pw-browsers`) — connexion,
toast de vente, invalidation du dashboard, cloche, persistance de session, mobile.
