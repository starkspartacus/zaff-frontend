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

export const NewModelSchema = z.object({
  category: z.string().trim().min(1, 'La catégorie est obligatoire.'),
  name: z.string().trim().min(2, 'Le nom est obligatoire.'),
  brand: z.string().trim(),
  model: z.string().trim(),
  color: z.string().trim(),
  barcode: z.string().trim().refine((v) => !v || /^[0-9A-Za-z\-]{6,32}$/.test(v), 'Code-barres invalide.'),
  purchasePrice: z.coerce.number().min(0, 'Prix invalide.'),
  salePrice: z.coerce.number().min(0, 'Prix invalide.'),
  condition: z.enum(['new', 'refurbished', 'used']).default('new'),
  accessories: z.string().trim().max(300, 'Trop long (300 caractères maximum).'),
});
export type NewModelInput = z.input<typeof NewModelSchema>;

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
