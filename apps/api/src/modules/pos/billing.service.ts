import { Prisma } from '@prisma/client';
import {
  computeTabTotals,
  fromCents,
  getBusinessDate,
  moveItemsSchema,
  paymentSchema,
  tabChargesSchema,
  toCents,
  type AuthUser,
  type MoveItemsInput,
  type PaymentInput,
  type TabChargesInput,
  type TicketDocument,
} from '@sanfefer/shared';
import { resolveAuthorizer } from '../../lib/authorization';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { getSettingsRow, toSettingsDto } from '../settings/settings.service';
import { computeBilling, lineTotal, paymentInclude, summarizeItems } from './pos.mapper';
import { getTab } from './tabs.service';

type Tx = Prisma.TransactionClient;
const D = (v: number) => new Prisma.Decimal(v);

/** Bloquea la fila de la cuenta: dos cobros simultáneos no pueden pasarse del total. */
async function lockTab(tx: Tx, tabId: number) {
  await tx.$queryRaw`SELECT id FROM "Tab" WHERE id = ${tabId} FOR UPDATE`;
}

async function loadBilling(tx: Tx | typeof prisma, tabId: number) {
  const tab = await tx.tab.findUnique({
    where: { id: tabId },
    include: {
      items: { select: { quantity: true, unitPrice: true, discountAmount: true, status: true } },
      payments: { include: paymentInclude },
    },
  });
  if (!tab) throw notFound('La cuenta no existe.');
  return { tab, billing: computeBilling(tab) };
}

function assertOpen(status: string) {
  if (status === 'PAID') throw conflict('Esta cuenta ya se cobró.');
  if (status === 'CANCELLED') throw conflict('Esta cuenta fue cancelada.');
}

/** Descuento (requiere autorización de admin) y cargo por servicio. */
export async function setCharges(tabId: number, raw: TabChargesInput, user: AuthUser) {
  const input = tabChargesSchema.parse(raw);
  const { tab, billing } = await loadBilling(prisma, tabId);
  assertOpen(tab.status);

  const data: Prisma.TabUpdateInput = {};
  if (input.discount !== undefined) {
    if (input.discount === null) {
      Object.assign(data, { discountType: null, discountValue: null, discountReason: null });
    } else {
      const admin = await resolveAuthorizer(user, input.authorizationPin, 'Aplicar un descuento');
      Object.assign(data, {
        discountType: input.discount.type,
        discountValue: D(input.discount.value),
        discountReason:
          admin.id === user.id
            ? input.discount.reason
            : `${input.discount.reason} (autorizó ${admin.name})`,
      });
    }
  }
  if (input.serviceChargeRate !== undefined) {
    data.serviceChargeRate = input.serviceChargeRate === null ? null : D(input.serviceChargeRate);
  }

  // Si ya se cobró una parte, el nuevo total no puede quedar por debajo de lo pagado.
  const discount =
    input.discount === undefined
      ? billing.discount
      : input.discount && { type: input.discount.type, value: input.discount.value };
  const rate =
    input.serviceChargeRate === undefined ? billing.serviceChargeRate : input.serviceChargeRate;
  const next = computeTabTotals(billing.subtotal, discount, rate);
  if (toCents(next.total) < toCents(billing.paid)) {
    throw conflict(
      `Ya se cobraron Q ${billing.paid.toFixed(2)}; el total no puede quedar por debajo de eso.`,
    );
  }

  await prisma.tab.update({ where: { id: tabId }, data });
  return getTab(tabId);
}

/** Cierra la cuenta congelando sus totales y la fecha de negocio (día del cobro). */
async function closePaidTab(tx: Tx, tabId: number, userId: number) {
  const { tab, billing } = await loadBilling(tx, tabId);
  await tx.tab.update({
    where: { id: tab.id },
    data: {
      status: 'PAID',
      subtotal: D(billing.subtotal),
      discountTotal: D(billing.discountTotal),
      serviceCharge: D(billing.serviceCharge),
      total: D(billing.total),
      businessDate: new Date(`${getBusinessDate()}T00:00:00.000Z`),
      closedAt: new Date(),
      closedById: userId,
    },
  });
}

export async function addPayment(tabId: number, raw: PaymentInput, user: AuthUser) {
  const input = paymentSchema.parse(raw);
  const session = await prisma.cashSession.findFirst({ where: { status: 'OPEN' } });
  if (!session) {
    throw new AppError(
      409,
      'CASH_CLOSED',
      'No hay una caja abierta. Abre la caja antes de cobrar.',
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockTab(tx, tabId);
    const { tab, billing } = await loadBilling(tx, tabId);
    assertOpen(tab.status);
    if (summarizeItems(tab.items).itemCount === 0)
      throw badRequest('La cuenta no tiene productos para cobrar.');
    if (toCents(input.amount) > toCents(billing.remaining)) {
      throw badRequest(
        `El monto es mayor a lo que falta por pagar (Q ${billing.remaining.toFixed(2)}).`,
        {
          amount: `Máximo Q ${billing.remaining.toFixed(2)}`,
        },
      );
    }
    const tendered = input.method === 'CASH' ? (input.tendered ?? input.amount) : null;
    const payment = await tx.payment.create({
      data: {
        tabId,
        cashSessionId: session.id,
        method: input.method,
        amount: D(input.amount),
        tendered: tendered === null ? null : D(tendered),
        change: tendered === null ? null : D(fromCents(toCents(tendered) - toCents(input.amount))),
        reference: input.method === 'CARD' ? input.reference : null,
        receivedById: user.id,
        businessDate: new Date(`${getBusinessDate()}T00:00:00.000Z`),
      },
      include: paymentInclude,
    });
    const closed = toCents(input.amount) === toCents(billing.remaining);
    if (closed) await closePaidTab(tx, tabId, user.id);
    return { paymentId: payment.id, closed, change: Number(payment.change ?? 0) };
  });
  return { ...result, tab: await getTab(tabId) };
}

/** Quita un pago registrado por error (solo mientras la cuenta sigue abierta). */
export async function deletePayment(paymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { tab: true },
  });
  if (!payment) throw notFound('El pago no existe.');
  if (payment.tab.status !== 'OPEN')
    throw conflict('La cuenta ya se cerró; su pago no se puede quitar.');
  await prisma.payment.delete({ where: { id: paymentId } });
  return getTab(payment.tabId);
}

/** Cierra una cuenta con total Q 0 (p. ej. descuento del 100 %). */
export async function closeZeroTab(tabId: number, user: AuthUser) {
  await prisma.$transaction(async (tx) => {
    await lockTab(tx, tabId);
    const { tab, billing } = await loadBilling(tx, tabId);
    assertOpen(tab.status);
    if (summarizeItems(tab.items).itemCount === 0)
      throw badRequest('La cuenta está vacía; cancélala en lugar de cerrarla.');
    if (toCents(billing.remaining) > 0) {
      throw badRequest(`Aún falta cobrar Q ${billing.remaining.toFixed(2)}.`);
    }
    await closePaidTab(tx, tabId, user.id);
  });
  return getTab(tabId);
}

/**
 * Mueve productos (o parte de una línea) a otra cuenta abierta o a una cuenta nueva.
 * Sirve para "dividir por productos".
 */
export async function moveItems(raw: MoveItemsInput, user: AuthUser) {
  const input = moveItemsSchema.parse(raw);
  const ids = input.items.map((i) => i.id);
  const items = await prisma.orderItem.findMany({
    where: { id: { in: ids } },
    include: { modifiers: true },
  });
  if (items.length !== new Set(ids).size)
    throw badRequest('Algunos productos ya no existen. Recarga la cuenta.');
  const sourceId = items[0]!.tabId;
  if (items.some((i) => i.tabId !== sourceId))
    throw badRequest('Los productos deben ser de la misma cuenta.');
  if (items.some((i) => i.status === 'CANCELLED'))
    throw badRequest('No se pueden mover productos cancelados.');
  const qty = new Map(input.items.map((i) => [i.id, i.quantity]));
  for (const item of items) {
    if (qty.get(item.id)! > item.quantity) {
      throw badRequest(`Solo hay ${item.quantity} de ${item.productName} en esta línea.`);
    }
  }

  const targetId = await prisma.$transaction(async (tx) => {
    await lockTab(tx, sourceId);
    const { tab: source, billing } = await loadBilling(tx, sourceId);
    assertOpen(source.status);

    let target: number;
    if (input.targetTabId !== undefined) {
      if (input.targetTabId === sourceId) throw badRequest('Elige una cuenta distinta.');
      const t = await tx.tab.findUnique({ where: { id: input.targetTabId } });
      if (!t) throw notFound('La cuenta de destino no existe.');
      assertOpen(t.status);
      target = t.id;
    } else {
      const { tableId, customerName } = input.newTab!;
      let name = customerName;
      if (!name) {
        const open = await tx.tab.findMany({
          where: { tableId, status: 'OPEN' },
          select: { customerName: true },
        });
        const used = new Set(open.map((o) => o.customerName.toLowerCase()));
        let n = 1;
        while (used.has(`cliente ${n}`)) n++;
        name = `Cliente ${n}`;
      }
      const created = await tx.tab.create({
        data: {
          tableId,
          customerName: name,
          openedById: user.id,
          serviceChargeRate: source.serviceChargeRate,
        },
      });
      target = created.id;
    }

    // Lo que queda en la cuenta de origen no puede ser menos de lo ya cobrado.
    const movedCents = items.reduce(
      (s, i) => s + toCents(lineTotal({ ...i, quantity: qty.get(i.id)! })),
      0,
    );
    if (billing.paid > 0) {
      const after = computeTabTotals(
        fromCents(toCents(billing.subtotal) - movedCents),
        billing.discount,
        billing.serviceChargeRate,
      );
      if (toCents(after.total) < toCents(billing.paid)) {
        throw conflict(
          'Ya se cobró parte de esta cuenta; lo que queda no puede ser menor a lo pagado.',
        );
      }
    }

    for (const item of items) {
      const quantity = qty.get(item.id)!;
      if (quantity === item.quantity) {
        await tx.orderItem.update({ where: { id: item.id }, data: { tabId: target } });
      } else {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { quantity: item.quantity - quantity },
        });
        await tx.orderItem.create({
          data: {
            tabId: target,
            orderId: item.orderId,
            productId: item.productId,
            productName: item.productName,
            quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            note: item.note,
            status: item.status,
            statusChangedAt: item.statusChangedAt,
            consumption: item.consumption ?? Prisma.JsonNull,
            modifiers: {
              create: item.modifiers.map((m) => ({
                optionId: m.optionId,
                groupName: m.groupName,
                optionName: m.optionName,
                priceDelta: m.priceDelta,
              })),
            },
          },
        });
      }
    }
    return target;
  });
  return { source: await getTab(sourceId), target: await getTab(targetId) };
}

const dateTime = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Guatemala',
});

/** Pre-cuenta (abierta) o comprobante interno (cobrada). Nunca es factura. */
export async function getTicket(
  tabId: number,
): Promise<{ document: TicketDocument; paperWidth: 58 | 80 }> {
  const [tab, settings] = await Promise.all([getTab(tabId), getSettingsRow().then(toSettingsDto)]);
  const b = tab.billing;
  const items = tab.orders.flatMap((o) => o.items).filter((i) => i.status !== 'CANCELLED');
  const document: TicketDocument = {
    kind: tab.status === 'PAID' ? 'COMPROBANTE' : 'PRECUENTA',
    businessName: settings.businessName,
    headerLines: [
      settings.address,
      settings.phone ? `Tel. ${settings.phone}` : null,
      settings.taxId ? `NIT ${settings.taxId}` : null,
    ].filter((x): x is string => !!x),
    meta: [
      ['Folio', `#${String(tab.id).padStart(6, '0')}`],
      [
        tab.table ? 'Mesa' : 'Cliente',
        tab.table ? `${tab.table.name} · ${tab.customerName}` : tab.customerName,
      ],
      ['Atendió', tab.openedBy.name.split(' ')[0]!],
      ['Fecha', dateTime.format(tab.closedAt ? new Date(tab.closedAt) : new Date())],
    ],
    items: items.map((i) => ({
      quantity: i.quantity,
      name: i.productName,
      details: i.modifiers.length ? [`+ ${i.modifiers.map((m) => m.optionName).join(', ')}`] : [],
      amount: i.lineTotal,
    })),
    totals: [
      { label: 'Subtotal', amount: b.subtotal },
      ...(b.discountTotal > 0
        ? [
            {
              label:
                b.discount?.type === 'PERCENT' ? `Descuento ${b.discount.value}%` : 'Descuento',
              amount: -b.discountTotal,
            },
          ]
        : []),
      ...(b.serviceCharge > 0
        ? [{ label: `Servicio ${b.serviceChargeRate}%`, amount: b.serviceCharge }]
        : []),
      { label: 'TOTAL', amount: b.total, strong: true },
    ],
    payments: b.payments.flatMap((p) =>
      p.method === 'CASH'
        ? [
            { label: 'Efectivo recibido', amount: p.tendered ?? p.amount },
            ...(p.change ? [{ label: 'Vuelto', amount: p.change }] : []),
          ]
        : [{ label: `Tarjeta${p.reference ? ` (${p.reference})` : ''}`, amount: p.amount }],
    ),
    footer: settings.ticketFooter ? [settings.ticketFooter] : [],
  };
  return { document, paperWidth: settings.paperWidth };
}
