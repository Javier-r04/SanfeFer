import {
  categoryInputSchema,
  categoryUpdateSchema,
  modifierGroupInputSchema,
  productInputSchema,
  productUpdateSchema,
  reorderSchema,
} from '@sanfefer/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as c from './catalog.controller';

export const catalogRouter = Router();
const admin = requireRole('ADMIN');
const activeSchema = z.object({ active: z.boolean({ error: 'Indica si está activo' }) });

// Lectura para cualquier usuario con sesión (el POS la usará); cambios solo admin.
catalogRouter.use(requireAuth);

catalogRouter.get('/categories', c.listCategories);
catalogRouter.post('/categories', admin, validateBody(categoryInputSchema), c.createCategory);
catalogRouter.post('/categories/reorder', admin, validateBody(reorderSchema), c.reorderCategories);
catalogRouter.patch('/categories/:id', admin, validateBody(categoryUpdateSchema), c.updateCategory);
catalogRouter.delete('/categories/:id', admin, c.deleteCategory);

catalogRouter.get('/products', c.listProducts);
catalogRouter.post('/products', admin, validateBody(productInputSchema), c.createProduct);
catalogRouter.post('/products/reorder', admin, validateBody(reorderSchema), c.reorderProducts);
catalogRouter.get('/products/:id', c.getProduct);
catalogRouter.patch('/products/:id', admin, validateBody(productUpdateSchema), c.updateProduct);
catalogRouter.delete('/products/:id', admin, c.deleteProduct);

catalogRouter.get('/modifier-groups', c.listModifierGroups);
catalogRouter.post(
  '/modifier-groups',
  admin,
  validateBody(modifierGroupInputSchema),
  c.createModifierGroup,
);
catalogRouter.put(
  '/modifier-groups/:id',
  admin,
  validateBody(modifierGroupInputSchema),
  c.updateModifierGroup,
);
catalogRouter.patch(
  '/modifier-groups/:id',
  admin,
  validateBody(activeSchema),
  c.setModifierGroupActive,
);
catalogRouter.delete('/modifier-groups/:id', admin, c.deleteModifierGroup);
