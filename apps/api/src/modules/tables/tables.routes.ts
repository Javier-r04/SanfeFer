import {
  reorderSchema,
  tableBulkSchema,
  tableInputSchema,
  tableUpdateSchema,
} from '@sanfefer/shared';
import { Router, type Request, type Response } from 'express';
import { parseId } from '../../lib/query';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as service from './tables.service';

export const tablesRouter = Router();

// Solo el administrador configura las mesas; el POS las lee desde /pos/floor.
tablesRouter.use(requireAuth, requireRole('ADMIN'));

tablesRouter.get('/', async (_req: Request, res: Response) => {
  res.json({ tables: await service.listTables() });
});
tablesRouter.post('/', validateBody(tableInputSchema), async (req: Request, res: Response) => {
  res.status(201).json({ table: await service.createTable(req.body) });
});
tablesRouter.post('/bulk', validateBody(tableBulkSchema), async (req: Request, res: Response) => {
  res.status(201).json(await service.createTables(req.body));
});
tablesRouter.post('/reorder', validateBody(reorderSchema), async (req: Request, res: Response) => {
  res.json({ tables: await service.reorderTables(req.body.ids) });
});
tablesRouter.patch('/:id', validateBody(tableUpdateSchema), async (req: Request, res: Response) => {
  res.json({ table: await service.updateTable(parseId(req), req.body) });
});
tablesRouter.delete('/:id', async (req: Request, res: Response) => {
  await service.deleteTable(parseId(req));
  res.status(204).end();
});
