import {
  purchaseInputSchema,
  supplierInputSchema,
  supplierUpdateSchema,
  voidPurchaseSchema,
} from '@sanfefer/shared';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as c from './purchases.controller';

export const purchasesRouter = Router();

purchasesRouter.use(requireAuth, requireRole('ADMIN'));

purchasesRouter.get('/suppliers', c.listSuppliers);
purchasesRouter.post('/suppliers', validateBody(supplierInputSchema), c.createSupplier);
purchasesRouter.patch('/suppliers/:id', validateBody(supplierUpdateSchema), c.updateSupplier);
purchasesRouter.delete('/suppliers/:id', c.deleteSupplier);

purchasesRouter.get('/', c.listPurchases);
purchasesRouter.post('/', validateBody(purchaseInputSchema), c.createPurchase);
purchasesRouter.get('/:id', c.getPurchase);
purchasesRouter.post('/:id/void', validateBody(voidPurchaseSchema), c.voidPurchase);
