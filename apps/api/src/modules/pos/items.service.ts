import { Prisma } from '@prisma/client';
import { computeTabTotals, fromCents, toCents } from '@sanfefer/shared';
import type { AuthUser, CancelItemInput } from '@sanfefer/shared';
import { resolveAuthorizer } from '../../lib/authorization';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { applyStockChange, lockInventoryItems } from '../inventory/stock';
import { computeBilling, lineTotal, paymentInclude } from './pos.mapper';

const D = (v: number | string) => new Prisma.Decimal(v);

async function getItemOrThrow(id: number) {
  const item = await prisma.orderItem.findUnique({ where: { id }, include: { tab: true } });
  if (!item) throw notFound('El producto de la orden no existe.');
  return item;
}

type Consumption = { inventoryItemId: number; quantity: number }[];

/**
 * Cancela una línea o parte de ella. Solo un administrador cancela (un vendedor necesita su PIN).
 * El inventario vuelve, salvo que el producto ya se haya preparado: entonces queda como merma.
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

  const prepared = input.wasted === true;
  const authorizedBy = (
    await resolveAuthorizer(user, input.authorizationPin, 'Solo un administrador cancela productos')
  ).id;
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
