import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// En desarrollo, tsx watch recarga módulos: se reutiliza el cliente para no abrir conexiones de más.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development' ? ['warn', 'error'] : env.NODE_ENV === 'test' ? [] : ['error'],
  });

if (!env.isProduction) globalForPrisma.prisma = prisma;
