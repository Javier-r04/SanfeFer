import { passwordLoginSchema, pinLoginSchema } from '@sanfefer/shared';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { loginRateLimit } from '../../middleware/rate-limit';
import { validateBody } from '../../middleware/validate';
import * as controller from './auth.controller';

export const authRouter = Router();

authRouter.get('/login-users', controller.loginUsers);
authRouter.post('/login/pin', loginRateLimit, validateBody(pinLoginSchema), controller.loginPin);
authRouter.post(
  '/login/password',
  loginRateLimit,
  validateBody(passwordLoginSchema),
  controller.loginPassword,
);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);
