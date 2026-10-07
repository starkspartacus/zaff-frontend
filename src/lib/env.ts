import { z } from 'zod';

/** Configuration publique validée au démarrage (une URL invalide échoue tout de suite, pas à la première requête) */
const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:8000/api'),
  /** Adresse publique de l'application (liens imprimés : QR code de garantie). Sinon : l'adresse ouverte dans le navigateur */
  NEXT_PUBLIC_APP_URL: z.url().optional(),
});

export const env = EnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
});

/** Lien public de vérification d'une garantie (encodé dans le QR code de la fiche) */
export const warrantyVerifyUrl = (code: string) => {
  const origin = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/verify?c=${encodeURIComponent(code)}`;
};

/** http://host:8000/api → http://host:8000 (le WebSocket est servi à la racine) */
export const API_ORIGIN = new URL(env.NEXT_PUBLIC_API_URL).origin;
