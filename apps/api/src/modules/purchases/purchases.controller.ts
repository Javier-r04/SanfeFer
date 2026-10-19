import { purchasesQuerySchema, suppliersQuerySchema } from '@sanfefer/shared';
import type { Request, Response } from 'express';
import { parseId, parseQuery } from '../../lib/query';
import { currentUser } from '../../middleware/auth';
import * as purchases from './purchases.service';
import * as suppliers from './suppliers.service';

export async function listSuppliers(req: Request, res: Response) {
  const { includeInactive } = parseQuery(suppliersQuerySchema, req);
  res.json({ suppliers: await suppliers.listSuppliers(includeInactive) });
}
export async function createSupplier(req: Request, res: Response) {
  res.status(201).json({ supplier: await suppliers.createSupplier(req.body) });
}
export async function updateSupplier(req: Request, res: Response) {
  res.json({ supplier: await suppliers.updateSupplier(parseId(req), req.body) });
}
export async function deleteSupplier(req: Request, res: Response) {
  await suppliers.deleteSupplier(parseId(req));
  res.status(204).end();
}

export async function listPurchases(req: Request, res: Response) {
  res.json(await purchases.listPurchases(parseQuery(purchasesQuerySchema, req)));
}
export async function getPurchase(req: Request, res: Response) {
  res.json({ purchase: await purchases.getPurchase(parseId(req)) });
}
export async function createPurchase(req: Request, res: Response) {
  res.status(201).json({ purchase: await purchases.createPurchase(req.body, currentUser(req).id) });
}
export async function voidPurchase(req: Request, res: Response) {
  res.json({
    purchase: await purchases.voidPurchase(parseId(req), req.body.reason, currentUser(req).id),
  });
}
