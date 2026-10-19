import { inventoryListQuerySchema, movementsQuerySchema } from '@sanfefer/shared';
import type { Request, Response } from 'express';
import { parseId, parseQuery } from '../../lib/query';
import { currentUser } from '../../middleware/auth';
import * as service from './inventory.service';

export async function listItems(req: Request, res: Response) {
  res.json({ items: await service.listItems(parseQuery(inventoryListQuerySchema, req)) });
}

export async function summary(_req: Request, res: Response) {
  res.json({ summary: await service.getSummary() });
}

export async function getItem(req: Request, res: Response) {
  res.json({ item: await service.getItem(parseId(req)) });
}

export async function createItem(req: Request, res: Response) {
  res.status(201).json({ item: await service.createItem(req.body, currentUser(req).id) });
}

export async function updateItem(req: Request, res: Response) {
  res.json({ item: await service.updateItem(parseId(req), req.body) });
}

export async function deleteItem(req: Request, res: Response) {
  await service.deleteItem(parseId(req));
  res.status(204).end();
}

export async function createMovement(req: Request, res: Response) {
  res.status(201).json(await service.createMovement(parseId(req), req.body, currentUser(req).id));
}

export async function listMovements(req: Request, res: Response) {
  res.json(await service.listMovements(parseQuery(movementsQuerySchema, req)));
}
