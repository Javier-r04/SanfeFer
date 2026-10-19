import { queryBoolean } from '@sanfefer/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { parseId, parseQuery } from '../../lib/query';
import * as categories from './categories.service';
import * as modifiers from './modifiers.service';
import * as products from './products.service';

// ── Categorías ──
export async function listCategories(_req: Request, res: Response) {
  res.json({ categories: await categories.listCategories() });
}
export async function createCategory(req: Request, res: Response) {
  res.status(201).json({ category: await categories.createCategory(req.body) });
}
export async function updateCategory(req: Request, res: Response) {
  res.json({ category: await categories.updateCategory(parseId(req), req.body) });
}
export async function deleteCategory(req: Request, res: Response) {
  await categories.deleteCategory(parseId(req));
  res.status(204).end();
}
export async function reorderCategories(req: Request, res: Response) {
  res.json({ categories: await categories.reorderCategories(req.body.ids) });
}

// ── Productos ──
const productsQuery = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  active: queryBoolean.optional(),
  q: z.string().trim().max(60).optional(),
});

export async function listProducts(req: Request, res: Response) {
  res.json({ products: await products.listProducts(parseQuery(productsQuery, req)) });
}
export async function getProduct(req: Request, res: Response) {
  res.json({ product: await products.getProduct(parseId(req)) });
}
export async function createProduct(req: Request, res: Response) {
  res.status(201).json({ product: await products.createProduct(req.body) });
}
export async function updateProduct(req: Request, res: Response) {
  res.json({ product: await products.updateProduct(parseId(req), req.body) });
}
export async function deleteProduct(req: Request, res: Response) {
  await products.deleteProduct(parseId(req));
  res.status(204).end();
}
export async function reorderProducts(req: Request, res: Response) {
  await products.reorderProducts(req.body.ids);
  res.status(204).end();
}

// ── Grupos de extras ──
export async function listModifierGroups(_req: Request, res: Response) {
  res.json({ groups: await modifiers.listModifierGroups() });
}
export async function createModifierGroup(req: Request, res: Response) {
  res.status(201).json({ group: await modifiers.createModifierGroup(req.body) });
}
export async function updateModifierGroup(req: Request, res: Response) {
  res.json({ group: await modifiers.updateModifierGroup(parseId(req), req.body) });
}
export async function setModifierGroupActive(req: Request, res: Response) {
  res.json({ group: await modifiers.setModifierGroupActive(parseId(req), req.body.active) });
}
export async function deleteModifierGroup(req: Request, res: Response) {
  await modifiers.deleteModifierGroup(parseId(req));
  res.status(204).end();
}
