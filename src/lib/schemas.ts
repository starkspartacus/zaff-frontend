import { z } from 'zod';

// ─── Temps réel : les messages reçus sont validés avant d'entrer dans l'état ───

export const NotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  level: z.enum(['info', 'success', 'warning', 'error']).catch('info'),
  data: z.record(z.string(), z.unknown()).catch({}),
  createdAt: z.string(),
  read: z.boolean().catch(false),
});
export type AppNotification = z.infer<typeof NotificationSchema>;

export const InvalidateSchema = z.object({ scopes: z.array(z.string()) });

export const PresenceSchema = z.array(
  z.object({ userId: z.string(), name: z.string(), role: z.string(), since: z.string() })
);
export type PresenceEntry = z.infer<typeof PresenceSchema>[number];

// ─── Formulaires ───

/** Connexion : par téléphone (pays choisi d'abord) ou par e-mail */
export const LoginSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('phone'),
    country: z.string().length(2, 'Choisissez le pays de votre numéro.'),
    identifier: z.string().trim().min(1, 'Renseignez votre numéro de téléphone.'),
    password: z.string().min(1, 'Renseignez votre mot de passe.'),
  }),
  z.object({
    mode: z.literal('email'),
    identifier: z.string().trim().toLowerCase().pipe(z.email('Adresse e-mail invalide.')),
    password: z.string().min(1, 'Renseignez votre mot de passe.'),
  }),
]);
export type LoginInput = z.input<typeof LoginSchema>;

/** Fiche produit (catalogue et mise en stock) : uniquement ce qui bloque l'enregistrement */
export const ProductFormSchema = z.object({
  category: z.string().trim().min(1, "Choisissez le type d'appareil."),
  name: z.string().trim().min(2, 'Indiquez le modèle (ou la désignation).'),
  sku: z.string().trim().min(1, 'Référence obligatoire.'),
  barcode: z.string().trim().refine((v) => !v || /^[0-9A-Za-z-]{6,32}$/.test(v), 'Code-barres invalide (6 à 32 chiffres ou lettres).'),
  salePrice: z.number({ error: 'Indiquez le prix de vente.' }).positive('Indiquez le prix de vente.'),
});

export const CreateUserSchema = z.object({
  name: z.string().trim().min(2, 'Le nom est obligatoire.'),
  phone: z.string().trim().regex(/^\+?[\d\s\-().]{8,}$/, 'Numéro de téléphone invalide.'),
  email: z.union([z.literal(''), z.email('E-mail invalide.')]),
  role: z.enum(['admin', 'seller', 'storekeeper']),
  password: z.string().min(6, 'Au moins 6 caractères.'),
});

export const CloseRegisterSchema = z.object({
  declaredCash: z
    .string()
    .trim()
    .min(1, 'Comptez les espèces de la caisse et indiquez le montant.')
    .transform((v) => Number(v.replace(/[\s.]/g, '').replace(',', '.')))
    .pipe(z.number({ message: 'Montant invalide.' }).min(0, 'Le montant ne peut pas être négatif.')),
  notes: z.string().trim().max(500, '500 caractères maximum.').optional(),
});

/** Erreurs Zod → { champ: message } pour l'affichage sous chaque champ */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}
