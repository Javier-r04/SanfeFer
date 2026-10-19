import { defineConfig } from 'prisma/config';

// Con archivo de configuración Prisma ya no lee .env por su cuenta.
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
