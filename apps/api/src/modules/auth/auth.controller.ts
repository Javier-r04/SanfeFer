import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { clearSessionCookie, setSessionCookie } from '../../lib/session';
import { toAuthUser } from '../users/users.mapper';
import * as authService from './auth.service';

export async function loginPin(req: Request, res: Response) {
  const user = await authService.loginWithPin(req.body);
  setSessionCookie(res, user);
  res.json({ user: toAuthUser(user) });
}

export async function loginPassword(req: Request, res: Response) {
  const user = await authService.loginWithPassword(req.body);
  setSessionCookie(res, user);
  res.json({ user: toAuthUser(user) });
}

export function logout(_req: Request, res: Response) {
  clearSessionCookie(res);
  res.status(204).end();
}

export function me(req: Request, res: Response) {
  res.json({ user: currentUser(req) });
}

export async function loginUsers(_req: Request, res: Response) {
  res.json({ users: await authService.listLoginTiles() });
}
