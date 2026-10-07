import { z } from 'zod';

/** Configuration publique validée au démarrage (une URL invalide échoue tout de suite, pas à la première requête) */
const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:8000/api'),
});

export const env = EnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
});

/** http://host:8000/api → http://host:8000 (le WebSocket est servi à la racine) */
export const API_ORIGIN = new URL(env.NEXT_PUBLIC_API_URL).origin;
