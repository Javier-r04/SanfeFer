import type { Request, Response } from 'express';
import { parseId } from '../../lib/query';
import { currentUser } from '../../middleware/auth';
import * as items from './items.service';
import * as menu from './menu.service';
import * as tabs from './tabs.service';

export async function getMenu(_req: Request, res: Response) {
  res.json({ categories: await menu.getMenu() });
}
export async function getFloor(_req: Request, res: Response) {
  res.json(await tabs.getFloor());
}
export async function openTab(req: Request, res: Response) {
  res.status(201).json({ tab: await tabs.openTab(req.body, currentUser(req).id) });
}
export async function getTab(req: Request, res: Response) {
  res.json({ tab: await tabs.getTab(parseId(req)) });
}
export async function updateTab(req: Request, res: Response) {
  res.json({ tab: await tabs.updateTab(parseId(req), req.body) });
}
export async function cancelTab(req: Request, res: Response) {
  await tabs.cancelTab(parseId(req), req.body?.reason, currentUser(req).id);
  res.status(204).end();
}
export async function sendOrder(req: Request, res: Response) {
  res.status(201).json(await tabs.sendOrder(parseId(req), req.body, currentUser(req).id));
}
export async function setItemStatus(req: Request, res: Response) {
  res.json({ item: await items.setItemStatus(parseId(req), req.body.status) });
}
export async function cancelItem(req: Request, res: Response) {
  const { tabId } = await items.cancelItem(parseId(req), req.body, currentUser(req));
  res.json({ tab: await tabs.getTab(tabId) });
}
export async function getBar(_req: Request, res: Response) {
  res.json(await items.getBar());
}
export async function advanceOrder(req: Request, res: Response) {
  res.json(await items.advanceOrder(parseId(req), req.body.to));
}
