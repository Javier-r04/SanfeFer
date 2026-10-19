import { idParamSchema } from '@sanfefer/shared';
import type { Request, Response } from 'express';
import { setSessionCookie } from '../../lib/session';
import { currentUser } from '../../middleware/auth';
import { toUserDto } from './users.mapper';
import * as usersService from './users.service';

const parseId = (req: Request) => idParamSchema.parse(req.params).id;

export async function list(_req: Request, res: Response) {
  const users = await usersService.listUsers();
  res.json({ users: users.map(toUserDto) });
}

export async function create(req: Request, res: Response) {
  const user = await usersService.createUser(req.body);
  res.status(201).json({ user: toUserDto(user) });
}

export async function update(req: Request, res: Response) {
  const actor = currentUser(req);
  const user = await usersService.updateUser(parseId(req), req.body, actor.id);
  // Si el admin cambió su propio PIN o contraseña, se renueva su sesión para no sacarlo.
  if (user.id === actor.id) setSessionCookie(res, user);
  res.json({ user: toUserDto(user) });
}

export async function unlock(req: Request, res: Response) {
  const user = await usersService.unlockUser(parseId(req));
  res.json({ user: toUserDto(user) });
}

export async function remove(req: Request, res: Response) {
  await usersService.deleteUser(parseId(req), currentUser(req).id);
  res.status(204).end();
}
