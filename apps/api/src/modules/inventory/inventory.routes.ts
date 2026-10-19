import {
  inventoryItemCreateSchema,
  inventoryItemUpdateSchema,
  movementInputSchema,
} from '@sanfefer/shared';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as controller from './inventory.controller';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth, requireRole('ADMIN'));
inventoryRouter.get('/summary', controller.summary);
inventoryRouter.get('/items', controller.listItems);
inventoryRouter.post('/items', validateBody(inventoryItemCreateSchema), controller.createItem);
inventoryRouter.get('/items/:id', controller.getItem);
inventoryRouter.patch('/items/:id', validateBody(inventoryItemUpdateSchema), controller.updateItem);
inventoryRouter.delete('/items/:id', controller.deleteItem);
inventoryRouter.post(
  '/items/:id/movements',
  validateBody(movementInputSchema),
  controller.createMovement,
);
inventoryRouter.get('/movements', controller.listMovements);
