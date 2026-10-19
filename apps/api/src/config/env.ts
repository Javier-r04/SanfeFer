import { z } from 'zod';

// Node >= 20.12 carga el archivo .env sin dependencias; no sobrescribe variables ya definidas.
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno (producción, pruebas).
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_HOURS: z.coerce.number().positive().default(12),
  /** Proxies delante de la API: 1 = solo Render; 2 = Vercel (reescritura de /api) + Render. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:');
  for (const issue of parsed.error.issues)
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  isProduction: data.NODE_ENV === 'production',
  corsOrigins: data.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  cookieSecure: data.COOKIE_SECURE ?? data.NODE_ENV === 'production',
};
