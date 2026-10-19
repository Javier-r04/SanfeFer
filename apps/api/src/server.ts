import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();

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
