import { env } from './config/env';
import { createApp } from './app';
import { ensureFirstAdmin } from './lib/bootstrap';
import { prisma } from './lib/prisma';

const app = createApp();

try {
  await ensureFirstAdmin();
} catch (err) {
  // Sin base de datos la API arranca igual: /api/health lo reporta y Render reintenta.
  console.error('No se pudo revisar el administrador inicial:', err);
}

const server = app.listen(env.PORT, () => {
  console.log(`✅ API de SanfeFer escuchando en http://localhost:${env.PORT}/api`);
});

async function shutdown(signal: string) {
  console.log(`${signal} recibido, cerrando…`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
