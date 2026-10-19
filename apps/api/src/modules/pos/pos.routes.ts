import {
  advanceOrderSchema,
  cancelItemSchema,
  cancelTabSchema,
  moveItemsSchema,
  paymentSchema,
  tabChargesSchema,
  itemStatusSchema,
  openTabSchema,
  sendOrderSchema,
  updateTabSchema,
} from '@sanfefer/shared';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as c from './pos.controller';

/** Punto de venta: vendedores y administradores. */
export const posRouter = Router();

posRouter.use(requireAuth);

posRouter.get('/menu', c.getMenu);
posRouter.get('/floor', c.getFloor);
posRouter.post('/tabs', validateBody(openTabSchema), c.openTab);
posRouter.get('/tabs/:id', c.getTab);
posRouter.patch('/tabs/:id', validateBody(updateTabSchema), c.updateTab);
posRouter.post('/tabs/:id/cancel', validateBody(cancelTabSchema), c.cancelTab);
posRouter.post('/tabs/:id/orders', validateBody(sendOrderSchema), c.sendOrder);
posRouter.patch('/items/:id/status', validateBody(itemStatusSchema), c.setItemStatus);
posRouter.post('/items/:id/cancel', validateBody(cancelItemSchema), c.cancelItem);
posRouter.patch('/tabs/:id/charges', validateBody(tabChargesSchema), c.setCharges);
posRouter.post('/tabs/:id/payments', validateBody(paymentSchema), c.addPayment);
posRouter.post('/tabs/:id/close', c.closeZeroTab);
posRouter.get('/tabs/:id/ticket', c.getTicket);
posRouter.delete('/payments/:id', c.deletePayment);
posRouter.post('/items/move', validateBody(moveItemsSchema), c.moveItems);
posRouter.get('/bar', c.getBar);
posRouter.post('/orders/:id/advance', validateBody(advanceOrderSchema), c.advanceOrder);
