import { getBusinessDate } from '@sanfefer/shared';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { cashRouter } from './modules/cash/cash.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { posRouter } from './modules/pos/pos.routes';
import { purchasesRouter } from './modules/purchases/purchases.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { usersRouter } from './modules/users/users.routes';

export function createApp() {
  const app = express();

  // Render y Vercel ponen un proxy delante: necesario para la IP real y cookies seguras.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  const api = express.Router();

  api.get('/health', async (_req, res) => {
    let db = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    res.status(db === 'ok' ? 200 : 503).json({
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      time: new Date().toISOString(),
      businessDate: getBusinessDate(),
    });
  });

  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/catalog', catalogRouter);
  api.use('/inventory', inventoryRouter);
  api.use('/purchases', purchasesRouter);
  api.use('/pos', posRouter);
  api.use('/cash', cashRouter);
  api.use('/settings', settingsRouter);
  api.use('/reports', reportsRouter);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
