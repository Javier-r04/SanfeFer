import { Prisma, type OrderItemStatus } from '@prisma/client';
import { computeTabTotals, fromCents, toCents } from '@sanfefer/shared';
import type { AuthUser, BarDto, CancelItemInput } from '@sanfefer/shared';
import { resolveAuthorizer } from '../../lib/authorization';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { applyStockChange, lockInventoryItems } from '../inventory/stock';
import {
  computeBilling,
  itemInclude,
  lineTotal,
  paymentInclude,
  toOrderItemDto,
} from './pos.mapper';

const D = (v: number | string) => new Prisma.Decimal(v);
const RECENT_DELIVERED_MS = 15 * 60 * 1000;

async function getItemOrThrow(id: number) {
  const item = await prisma.orderItem.findUnique({ where: { id }, include: { tab: true } });
  if (!item) throw notFound('El producto de la orden no existe.');
  return item;
}

export async function setItemStatus(id: number, status: Exclude<OrderItemStatus, 'CANCELLED'>) {
  const item = await getItemOrThrow(id);
  if (item.status === 'CANCELLED') throw conflict('Este producto fue cancelado.');
  if (item.tab.status === 'CANCELLED') throw conflict('La cuenta fue cancelada.');
  const updated = await prisma.orderItem.update({
    where: { id },
    data: { status, statusChangedAt: new Date() },
    include: itemInclude,
  });
  return toOrderItemDto(updated);
}

/** "Empezar" (pendientes → preparando) o "Entregar" (todo lo vigente → entregado) en una comanda. */
export async function advanceOrder(orderId: number, to: 'PREPARING' | 'DELIVERED') {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('La comanda no existe.');
  const from: OrderItemStatus[] = to === 'PREPARING' ? ['PENDING'] : ['PENDING', 'PREPARING'];
  const { count } = await prisma.orderItem.updateMany({
    where: { orderId, status: { in: from } },
    data: { status: to, statusChangedAt: new Date() },
  });
  return { updated: count };
}

export async function getBar(): Promise<BarDto> {
  const recent = new Date(Date.now() - RECENT_DELIVERED_MS);
  const orders = await prisma.order.findMany({
    where: {
      tab: { status: { not: 'CANCELLED' } },
      items: {
        some: {
          OR: [
            { status: { in: ['PENDING', 'PREPARING'] } },
            { status: 'DELIVERED', statusChangedAt: { gte: recent } },
          ],
        },
      },
    },
    include: {
      tab: { include: { table: { select: { name: true } } } },
      createdBy: { select: { id: true, name: true } },
      items: {
        where: { status: { not: 'CANCELLED' } },
        include: itemInclude,
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { sentAt: 'asc' },
  });
  return {
    orders: orders.map((o) => ({
      id: o.id,
      sentAt: o.sentAt.toISOString(),
      tab: { id: o.tab.id, customerName: o.tab.customerName, tableName: o.tab.table?.name ?? null },
      createdBy: o.createdBy,
      items: o.items.map(toOrderItemDto),
    })),
    activeCount: orders.filter((o) =>
      o.items.some((i) => i.status === 'PENDING' || i.status === 'PREPARING'),
    ).length,
  };
}

type Consumption = { inventoryItemId: number; quantity: number }[];

/**
 * Cancela una línea o parte de ella. Si aún estaba pendiente, el inventario vuelve;
 * si ya se preparó, se registra como merma (autorizada por un admin).
 */
export async function cancelItem(id: number, input: CancelItemInput, user: AuthUser) {
  const item = await getItemOrThrow(id);
  if (item.status === 'CANCELLED') throw conflict('Este producto ya estaba cancelado.');
  if (item.tab.status !== 'OPEN') throw conflict('La cuenta ya está cerrada.');
  const quantity = input.quantity ?? item.quantity;
  if (quantity > item.quantity) {
    throw badRequest(`Solo hay ${item.quantity} en esta línea.`, {
      quantity: `Máximo ${item.quantity}`,
    });
  }
  // Si ya se cobró una parte de la cuenta, cancelar no puede dejar el total por debajo de lo pagado.
  const tabBilling = await prisma.tab.findUniqueOrThrow({
    where: { id: item.tabId },
    include: { items: true, payments: { include: paymentInclude } },
  });
  const billing = computeBilling(tabBilling);
  if (billing.paid > 0) {
    const removed = toCents(lineTotal({ ...item, quantity }));
    const after = computeTabTotals(
      fromCents(toCents(billing.subtotal) - removed),
      billing.discount,
      billing.serviceChargeRate,
    );
    if (toCents(after.total) < toCents(billing.paid)) {
      throw conflict(
        'Ya se cobró parte de esta cuenta. Quita el pago antes de cancelar este producto.',
      );
    }
  }

  const prepared = item.status !== 'PENDING';
  const authorizedBy = prepared
    ? (
        await resolveAuthorizer(
          user,
          input.authorizationPin,
          'Este producto ya se está preparando o se entregó',
        )
      ).id
    : null;
  const consumption = (item.consumption as Consumption | null) ?? [];

  await prisma.$transaction(async (tx) => {
    const cancelData = {
      status: 'CANCELLED' as const,
      statusChangedAt: new Date(),
      cancelledById: user.id,
      cancelAuthorizedById: authorizedBy,
      cancelReason: input.reason,
    };
    let cancelledId = id;
    if (quantity < item.quantity) {
      // Cancelación parcial: la línea se divide y la parte cancelada queda como línea propia.
      await tx.orderItem.update({ where: { id }, data: { quantity: item.quantity - quantity } });
      const modifiers = await tx.orderItemModifier.findMany({ where: { orderItemId: id } });
      const copy = await tx.orderItem.create({
        data: {
          tabId: item.tabId,
          orderId: item.orderId,
          productId: item.productId,
          productName: item.productName,
          quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          note: item.note,
          consumption: item.consumption ?? Prisma.JsonNull,
          ...cancelData,
          modifiers: {
            create: modifiers.map((m) => ({
              optionId: m.optionId,
              groupName: m.groupName,
              optionName: m.optionName,
              priceDelta: m.priceDelta,
            })),
          },
        },
      });
      cancelledId = copy.id;
    } else {
      await tx.orderItem.update({ where: { id }, data: cancelData });
    }

    await lockInventoryItems(
      tx,
      consumption.map((c) => c.inventoryItemId),
    );
    for (const c of consumption) {
      const qty = D(c.quantity).times(quantity);
      await applyStockChange(tx, {
        itemId: c.inventoryItemId,
        delta: qty,
        type: 'SALE_VOID',
        reason: `Cancelado: ${input.reason}`,
        userId: user.id,
        orderItemId: cancelledId,
      });
      if (prepared) {
        // Ya se preparó: el insumo se perdió aunque no se cobre.
        await applyStockChange(tx, {
          itemId: c.inventoryItemId,
          delta: qty.neg(),
          type: 'WASTE',
          reason: `Cancelado ya preparado: ${input.reason}`,
          userId: user.id,
          orderItemId: cancelledId,
        });
      }
    }
  });
  return { tabId: item.tabId };
}
