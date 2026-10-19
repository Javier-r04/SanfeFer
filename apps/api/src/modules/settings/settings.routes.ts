import { settingsSchema } from '@sanfefer/shared';
import { Router, type Request, type Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as service from './settings.service';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
// Lectura para todos: el POS necesita el % de servicio y los datos del ticket.
settingsRouter.get('/', async (_req: Request, res: Response) => {
  res.json({ settings: await service.getSettings() });
});
settingsRouter.patch(
  '/',
  requireRole('ADMIN'),
  validateBody(settingsSchema),
  async (req: Request, res: Response) => {
    res.json({ settings: await service.updateSettings(req.body) });
  },
);
