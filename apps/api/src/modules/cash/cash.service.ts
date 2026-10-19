import { Prisma } from '@prisma/client';
import {
  businessDayRange,
  cashMovementSchema,
  closeCashSchema,
  fromCents,
  getBusinessDate,
  openCashSchema,
  toCents,
  type CashMovementInput,
  type CashSessionDto,
  type CashSessionsQuery,
  type CloseCashInput,
  type DailyCloseDto,
  type OpenCashInput,
  type Page,
} from '@sanfefer/shared';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { lineTotal } from '../pos/pos.mapper';

const D = (v: number) => new Prisma.Decimal(v);
const user = { select: { id: true, name: true } } as const;
const time = new Intl.DateTimeFormat('es-GT', {
  timeStyle: 'short',
  timeZone: 'America/Guatemala',
});

const sessionInclude = {
  openedBy: user,
  closedBy: user,
  movements: { include: { user }, orderBy: { id: 'asc' } },
  payments: { select: { method: true, amount: true } },
} satisfies Prisma.CashSessionInclude;

type SessionRow = Prisma.CashSessionGetPayload<{ include: typeof sessionInclude }>;

/** Resumen de una sesión: lo que entró por método y el efectivo que debería haber. */
function toSessionDto(s: SessionRow): CashSessionDto {
  const sum = (rows: { amount: Prisma.Decimal }[]) =>
    rows.reduce((acc, r) => acc + toCents(Number(r.amount)), 0);
  const cash = sum(s.payments.filter((p) => p.method === 'CASH'));
  const card = sum(s.payments.filter((p) => p.method === 'CARD'));
  const mIn = sum(s.movements.filter((m) => m.type === 'IN'));
  const mOut = sum(s.movements.filter((m) => m.type === 'OUT'));
  const expected = toCents(Number(s.openingAmount)) + cash + mIn - mOut;
  return {
    id: s.id,
    status: s.status,
    openingAmount: Number(s.openingAmount),
    openedBy: s.openedBy,
    openedAt: s.openedAt.toISOString(),
    closedBy: s.closedBy,
    closedAt: s.closedAt?.toISOString() ?? null,
    cashSales: fromCents(cash),
    cardSales: fromCents(card),
    movementsIn: fromCents(mIn),
    movementsOut: fromCents(mOut),
    // Cerrada: se muestra lo que se calculó al cerrar.
    expectedCash: s.expectedCash === null ? fromCents(expected) : Number(s.expectedCash),
    countedCash: s.countedCash === null ? null : Number(s.countedCash),
    difference: s.difference === null ? null : Number(s.difference),
    paymentsCount: s.payments.length,
    notes: s.notes,
    movements: s.movements.map((m) => ({
      id: m.id,
      type: m.type,
      amount: Number(m.amount),
      reason: m.reason,
      user: m.user,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

async function openSessionOrThrow() {
  const s = await prisma.cashSession.findFirst({
    where: { status: 'OPEN' },
    include: sessionInclude,
  });
  if (!s) throw new AppError(409, 'CASH_CLOSED', 'No hay una caja abierta.');
  return s;
}

export async function getCurrent() {
  const s = await prisma.cashSession.findFirst({
    where: { status: 'OPEN' },
    include: sessionInclude,
  });
  return s ? toSessionDto(s) : null;
}

export async function openCash(raw: OpenCashInput, userId: number) {
  const input = openCashSchema.parse(raw);
  const current = await prisma.cashSession.findFirst({
    where: { status: 'OPEN' },
    include: { openedBy: true },
  });
  const already = (s: { openedBy: { name: string }; openedAt: Date }) =>
    conflict(
      `Ya hay una caja abierta (la abrió ${s.openedBy.name.split(' ')[0]} a las ${time.format(s.openedAt)}).`,
    );
  if (current) throw already(current);
  try {
    await prisma.cashSession.create({
      data: { openingAmount: D(input.openingAmount), notes: input.notes, openedById: userId },
    });
  } catch (err) {
    // Dos dispositivos abriendo al mismo tiempo: el índice único deja pasar solo uno.
    if ((err as { code?: string }).code === 'P2002') {
      const winner = await prisma.cashSession.findFirstOrThrow({
        where: { status: 'OPEN' },
        include: { openedBy: true },
      });
      throw already(winner);
    }
    throw err;
  }
  return (await getCurrent())!;
}

export async function addMovement(raw: CashMovementInput, userId: number) {
  const input = cashMovementSchema.parse(raw);
  const session = toSessionDto(await openSessionOrThrow());
  if (input.type === 'OUT' && toCents(input.amount) > toCents(session.expectedCash)) {
    throw badRequest(
      `No hay tanto efectivo en caja: deberían haber Q ${session.expectedCash.toFixed(2)}.`,
      {
        amount: `Máximo Q ${session.expectedCash.toFixed(2)}`,
      },
    );
  }
  await prisma.cashMovement.create({
    data: {
      cashSessionId: session.id,
      type: input.type,
      amount: D(input.amount),
      reason: input.reason,
      userId,
    },
  });
  return (await getCurrent())!;
}

export async function closeCash(raw: CloseCashInput, userId: number) {
  const input = closeCashSchema.parse(raw);
  const session = toSessionDto(await openSessionOrThrow());
  const difference = fromCents(toCents(input.countedCash) - toCents(session.expectedCash));
  await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: 'CLOSED',
      expectedCash: D(session.expectedCash),
      countedCash: D(input.countedCash),
      difference: D(difference),
      notes: [session.notes, input.notes].filter(Boolean).join(' · ') || null,
      closedById: userId,
      closedAt: new Date(),
    },
  });
  return getSession(session.id);
}

export async function getSession(id: number) {
  const s = await prisma.cashSession.findUnique({ where: { id }, include: sessionInclude });
  if (!s) throw notFound('La sesión de caja no existe.');
  return toSessionDto(s);
}

export async function listSessions(query: CashSessionsQuery): Promise<Page<CashSessionDto>> {
  const openedAt: Prisma.DateTimeFilter = {};
  if (query.from) openedAt.gte = businessDayRange(query.from).start;
  if (query.to) openedAt.lt = businessDayRange(query.to).end;
  const rows = await prisma.cashSession.findMany({
    where: {
      openedAt: query.from || query.to ? openedAt : undefined,
      id: query.cursor ? { lt: query.cursor } : undefined,
    },
    include: sessionInclude,
    orderBy: { id: 'desc' },
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit);
  return {
    items: items.map(toSessionDto),
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}

/** Cierre del día: lo cobrado en la fecha de negocio (día calendario en Guatemala). */
export async function getDaily(date = getBusinessDate()): Promise<DailyCloseDto> {
  const day = new Date(`${date}T00:00:00.000Z`);
  const { start, end } = businessDayRange(date);

  const [tabs, payments, cancelled, sessions, openTabs] = await Promise.all([
    prisma.tab.findMany({
      where: { status: 'PAID', businessDate: day },
      include: { openedBy: user, items: { where: { status: { not: 'CANCELLED' } } } },
    }),
    prisma.payment.findMany({
      where: { businessDate: day },
      select: { method: true, amount: true },
    }),
    prisma.orderItem.findMany({
      where: { status: 'CANCELLED', statusChangedAt: { gte: start, lt: end } },
      select: { quantity: true, unitPrice: true, discountAmount: true, status: true },
    }),
    prisma.cashSession.findMany({
      where: {
        OR: [
          { openedAt: { gte: start, lt: end } },
          { closedAt: { gte: start, lt: end } },
          { status: 'OPEN' },
        ],
      },
      include: sessionInclude,
      orderBy: { id: 'asc' },
    }),
    date === getBusinessDate()
      ? prisma.tab.count({ where: { status: 'OPEN' } })
      : Promise.resolve(0),
  ]);

  const cents = (n: Prisma.Decimal | number) => toCents(Number(n));
  const total = tabs.reduce((s, t) => s + cents(t.total), 0);
  const sellers = new Map<number, { id: number; name: string; tabs: number; total: number }>();
  const products = new Map<string, { name: string; quantity: number; total: number }>();
  for (const t of tabs) {
    const s = sellers.get(t.openedBy.id) ?? { ...t.openedBy, tabs: 0, total: 0 };
    s.tabs += 1;
    s.total += cents(t.total);
    sellers.set(t.openedBy.id, s);
    for (const i of t.items) {
      const p = products.get(i.productName) ?? { name: i.productName, quantity: 0, total: 0 };
      p.quantity += i.quantity;
      p.total += toCents(lineTotal(i));
      products.set(i.productName, p);
    }
  }

  return {
    date,
    tabsPaid: tabs.length,
    subtotal: fromCents(tabs.reduce((s, t) => s + cents(t.subtotal), 0)),
    discounts: fromCents(tabs.reduce((s, t) => s + cents(t.discountTotal), 0)),
    serviceCharges: fromCents(tabs.reduce((s, t) => s + cents(t.serviceCharge), 0)),
    total: fromCents(total),
    cash: fromCents(
      payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + cents(p.amount), 0),
    ),
    card: fromCents(
      payments.filter((p) => p.method === 'CARD').reduce((s, p) => s + cents(p.amount), 0),
    ),
    averageTicket: tabs.length ? fromCents(Math.round(total / tabs.length)) : 0,
    unitsSold: [...products.values()].reduce((s, p) => s + p.quantity, 0),
    cancelled: {
      units: cancelled.reduce((s, i) => s + i.quantity, 0),
      amount: fromCents(cancelled.reduce((s, i) => s + toCents(lineTotal(i)), 0)),
    },
    bySeller: [...sellers.values()]
      .sort((a, b) => b.total - a.total)
      .map((s) => ({ ...s, total: fromCents(s.total) })),
    topProducts: [...products.values()]
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
      .slice(0, 10)
      .map((p) => ({ ...p, total: fromCents(p.total) })),
    sessions: sessions.map(toSessionDto),
    openTabs,
  };
}
