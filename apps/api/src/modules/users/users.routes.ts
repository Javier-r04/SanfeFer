import { createUserSchema, updateUserSchema } from '@sanfefer/shared';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as controller from './users.controller';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole('ADMIN'));
usersRouter.get('/', controller.list);
usersRouter.post('/', validateBody(createUserSchema), controller.create);
usersRouter.patch('/:id', validateBody(updateUserSchema), controller.update);
usersRouter.post('/:id/unlock', controller.unlock);
usersRouter.delete('/:id', controller.remove);
