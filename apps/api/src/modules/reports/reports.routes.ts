import { reportRangeSchema, salesReportQuerySchema } from '@sanfefer/shared';
import { Router, type Request, type Response } from 'express';
import { parseQuery } from '../../lib/query';
import { requireAuth, requireRole } from '../../middleware/auth';
import * as service from './reports.service';

export const reportsRouter = Router();

// Solo el administrador ve reportes.
reportsRouter.use(requireAuth, requireRole('ADMIN'));

reportsRouter.get('/sales', async (req: Request, res: Response) => {
  res.json({ report: await service.salesReport(parseQuery(salesReportQuerySchema, req)) });
});
reportsRouter.get('/products', async (req: Request, res: Response) => {
  res.json({ report: await service.productsReport(parseQuery(reportRangeSchema, req)) });
});
reportsRouter.get('/sellers', async (req: Request, res: Response) => {
  res.json({ report: await service.sellersReport(parseQuery(reportRangeSchema, req)) });
});
reportsRouter.get('/inventory', async (req: Request, res: Response) => {
  res.json({ report: await service.inventoryReport(parseQuery(reportRangeSchema, req)) });
});
reportsRouter.get('/tabs', async (req: Request, res: Response) => {
  res.json({ tabs: await service.tabsReport(parseQuery(reportRangeSchema, req)) });
});
