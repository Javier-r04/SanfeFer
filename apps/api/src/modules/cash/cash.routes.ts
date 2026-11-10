import {
  cashMovementSchema,
  cashSessionsQuerySchema,
  closeCashSchema,
  dailyQuerySchema,
  openCashSchema,
} from '@sanfefer/shared';
import { Router, type Request, type Response } from 'express';
import { parseId, parseQuery } from '../../lib/query';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as service from './cash.service';

export const cashRouter = Router();
const admin = requireRole('ADMIN');

// Solo el administrador ve y maneja la caja. Los vendedores cobran, pero no ven montos de caja:
// el POS solo pregunta si hay una abierta (/pos/cash-status).
cashRouter.use(requireAuth, admin);

cashRouter.get('/current', async (_req: Request, res: Response) => {
  res.json({ session: await service.getCurrent() });
});
cashRouter.post('/open', validateBody(openCashSchema), async (req: Request, res: Response) => {
  res.status(201).json({ session: await service.openCash(req.body, currentUser(req).id) });
});
cashRouter.post(
  '/movements',
  validateBody(cashMovementSchema),
  async (req: Request, res: Response) => {
    res.status(201).json({ session: await service.addMovement(req.body, currentUser(req).id) });
  },
);
cashRouter.post('/close', validateBody(closeCashSchema), async (req: Request, res: Response) => {
  res.json({ session: await service.closeCash(req.body, currentUser(req).id) });
});
cashRouter.get('/daily', async (req: Request, res: Response) => {
  const { date } = parseQuery(dailyQuerySchema, req);
  res.json({ daily: await service.getDaily(date) });
});
cashRouter.get('/sessions', async (req: Request, res: Response) => {
  res.json(await service.listSessions(parseQuery(cashSessionsQuerySchema, req)));
});
cashRouter.get('/sessions/:id', async (req: Request, res: Response) => {
  res.json({ session: await service.getSession(parseId(req)) });
});
