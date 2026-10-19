/**
 * Historial de ventas del seed: varias semanas de cuentas cobradas, cajas cerradas,
 * compras semanales y mermas, con todos sus movimientos de inventario.
 *
 * Todo se calcula primero en memoria (con un generador aleatorio de semilla fija, así cada
 * corrida da los mismos números) y luego se escribe con createMany e ids explícitos:
 * los folios quedan en orden cronológico y la carga tarda segundos.
 *
 * El inventario cuadra: cada venta deja su salida, las compras se piden según lo que se
 * consumirá en la semana, y el stock inicial se calcula para que el stock final sea
 * exactamente el de la lista del seed (con sus alertas de stock bajo y agotado).
 */
import { Prisma, type MovementType, type PrismaClient } from '@prisma/client';
import {
  addDays,
  businessDayRange,
  computeTabTotals,
  fromCents,
  getBusinessDate,
  isoWeekday,
  suggestedBills,
  toCents,
} from '@sanfefer/shared';

const D = (v: number) => new Prisma.Decimal(v);

export interface SamplePurchase {
  supplier: string;
  daysAgo: number;
  invoice: string | null;
  lines: [string, number, number][]; // [artículo, cantidad, total de la línea]
}

// ───────────── Parámetros del negocio simulado ─────────────

/** Popularidad relativa de cada producto (los que no aparecen valen 1). */
const PRODUCT_WEIGHTS: Record<string, number> = {
  'Michelada clásica': 16,
  'Michelada cubana': 8,
  'Michelada Clamato': 10,
  'Michelada de camarón': 3,
  'Michelada de mango': 4,
  'Michelada de tamarindo': 3,
  Chelada: 5,
  'Michelada sin alcohol': 0.6,
  Gallo: 15,
  Cabro: 6,
  'Monte Carlo': 4,
  'Dorada Draft': 2.5,
  Moza: 2,
  Corona: 3,
  'Modelo Especial': 2.5,
  'Cuba libre': 4,
  'Trago de Zacapa 23': 0.4,
  'Agua pura': 2.5,
  'Coca-Cola': 4,
  'Agua mineral': 1.5,
  'Limonada natural': 2.5,
  'Nachos con queso': 4,
  'Maní salado': 2.5,
  Papalinas: 2.5,
};

/** Preferencia dentro de un grupo de extras (las demás opciones valen 1). */
const OPTION_WEIGHTS: Record<string, number> = {
  Gallo: 7,
  Cabro: 2.5,
  'Monte Carlo': 1.5,
  Corona: 1.2,
  'Modelo Especial': 1,
  'Sal y limón': 6,
  Tajín: 3,
  'Chamoy y tajín': 2,
  'Sin escarchado': 1.5,
};

/** Probabilidad de cada extra opcional de selección múltiple. */
const MULTI_OPTION_CHANCE: Record<string, number> = {
  Camarones: 0.08,
  'Doble clamato': 0.07,
  'Extra picante': 0.12,
};

/** Ventas relativas por día de la semana (lunes … domingo). */
const WEEKDAY_FACTOR = [0.5, 0.6, 0.75, 0.95, 1.45, 1.75, 1.1];

/** Peso de cada hora de apertura de cuenta (hora local). */
const HOUR_WEIGHTS: [number, number][] = [
  [16, 1],
  [17, 2],
  [18, 3.5],
  [19, 5],
  [20, 6],
  [21, 5.5],
  [22, 3.5],
  [23, 0.8],
];

const WALK_IN_NAMES = [
  'Don Beto',
  'Karla',
  'Pedro',
  'Doña Chepita',
  'José',
  'Andrea',
  'Mario',
  'Lucía',
];
const CANCEL_REASONS = ['El cliente cambió de opinión', 'Se pidió por error', 'Ya no lo quiso'];

/** Proveedor y presentación de compra de cada artículo. */
const SUPPLY: Record<string, [supplier: string, pack: number]> = {
  'Cerveza Gallo 350 ml': ['Cervecería Centro Americana', 24],
  'Cerveza Cabro 350 ml': ['Cervecería Centro Americana', 24],
  'Cerveza Monte Carlo 350 ml': ['Cervecería Centro Americana', 24],
  'Cerveza Dorada Draft 350 ml': ['Cervecería Centro Americana', 24],
  'Cerveza Moza 350 ml': ['Cervecería Centro Americana', 24],
  'Corona 355 ml': ['Distribuidora de Licores del Centro', 24],
  'Modelo Especial 355 ml': ['Distribuidora de Licores del Centro', 24],
  'Ron Botrán Añejo': ['Distribuidora de Licores del Centro', 750],
  'Ron Zacapa 23': ['Distribuidora de Licores del Centro', 750],
  'Agua pura 600 ml': ['Distribuidora de Licores del Centro', 24],
  'Coca-Cola 355 ml': ['Distribuidora de Licores del Centro', 24],
  'Agua mineral Salutaris 355 ml': ['Distribuidora de Licores del Centro', 24],
  'Camarón cocido': ['Mariscos del Pacífico', 454],
  Clamato: ['Abarrotería La Terminal', 946],
  Limón: ['Abarrotería La Terminal', 50],
  'Salsa inglesa': ['Abarrotería La Terminal', 500],
  'Salsa picante': ['Abarrotería La Terminal', 500],
  Sal: ['Abarrotería La Terminal', 1000],
  Tajín: ['Abarrotería La Terminal', 200],
  Chamoy: ['Abarrotería La Terminal', 1000],
  'Pulpa de mango': ['Abarrotería La Terminal', 1000],
  'Pulpa de tamarindo': ['Abarrotería La Terminal', 1000],
  Azúcar: ['Abarrotería La Terminal', 1000],
  Totopos: ['Abarrotería La Terminal', 1000],
  'Queso para nachos': ['Abarrotería La Terminal', 1000],
  'Maní salado': ['Abarrotería La Terminal', 1000],
  'Papalinas (bolsa)': ['Abarrotería La Terminal', 12],
};

/** Mermas ocasionales: [artículo, cantidad, motivo]. */
const WASTES: [string, number, string][] = [
  ['Cerveza Gallo 350 ml', 1, 'Se quebró una botella'],
  ['Limón', 8, 'Limones en mal estado'],
  ['Clamato', 250, 'Se derramó al servir'],
  ['Coca-Cola 355 ml', 1, 'Lata golpeada'],
  ['Cerveza Cabro 350 ml', 1, 'Se quebró una botella'],
];

// ───────────── Utilidades ─────────────

/** Generador pseudoaleatorio reproducible (mulberry32). */
function createRng(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)]!,
    weighted: <T>(list: readonly T[], weight: (x: T) => number) => {
      const total = list.reduce((s, x) => s + weight(x), 0);
      let r = next() * total;
      for (const x of list) {
        r -= weight(x);
        if (r < 0) return x;
      }
      return list[list.length - 1]!;
    },
  };
}

/** Instante de una hora local (America/Guatemala) de un día de negocio. */
const localTime = (date: string, minutes: number) =>
  new Date(businessDayRange(date).start.getTime() + minutes * 60_000);
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

interface StockEvent {
  at: Date;
  order: number; // desempate: inicial → compras → ventas → devoluciones/mermas
  itemId: number;
  type: MovementType;
  quantity: number; // + entra / − sale
  unitCost: number;
  reason: string;
  userId: number;
  purchaseItemId?: number;
  orderItemId?: number;
}

// ───────────── Generación ─────────────

export async function seedHistory(
  prisma: PrismaClient,
  opts: { days: number; adminId: number; adminName: string; samplePurchases: SamplePurchase[] },
) {
  const rng = createRng(20261019);
  const today = getBusinessDate();
  const firstDay = addDays(today, -opts.days);

  const [items, products, tables, sellers, suppliers] = await Promise.all([
    prisma.inventoryItem.findMany(),
    prisma.product.findMany({
      where: { active: true },
      include: {
        recipe: true,
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            group: {
              include: {
                options: { orderBy: { sortOrder: 'asc' }, include: { components: true } },
              },
            },
          },
        },
      },
    }),
    prisma.diningTable.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.user.findMany({ where: { role: 'SELLER' }, orderBy: { id: 'asc' } }),
    prisma.supplier.findMany(),
  ]);
  const itemByName = new Map(items.map((i) => [i.name, i]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const cost = (itemId: number) => Number(itemById.get(itemId)!.averageCost);
  const supplierId = (name: string) => suppliers.find((s) => s.name === name)!.id;

  const events: StockEvent[] = [];
  const ids = { tab: 0, order: 0, item: 0, modifier: 0, payment: 0, session: 0, cashMove: 0 };
  const rows = {
    sessions: [] as Prisma.CashSessionCreateManyInput[],
    cashMoves: [] as Prisma.CashMovementCreateManyInput[],
    tabs: [] as Prisma.TabCreateManyInput[],
    orders: [] as Prisma.OrderCreateManyInput[],
    items: [] as Prisma.OrderItemCreateManyInput[],
    modifiers: [] as Prisma.OrderItemModifierCreateManyInput[],
    payments: [] as Prisma.PaymentCreateManyInput[],
  };

  // ── Ventas día por día ──
  for (let day = firstDay, index = 0; day < today; day = addDays(day, 1), index++) {
    const growth = 0.85 + (0.3 * index) / opts.days; // el negocio crece un poco semana a semana
    const tabCount = Math.max(
      3,
      Math.round(13 * WEEKDAY_FACTOR[isoWeekday(day) - 1]! * growth * (0.85 + rng.next() * 0.3)),
    );
    const opener = sellers[index % sellers.length]!;
    const crew = [opener, ...sellers.filter((s) => s.id !== opener.id && rng.chance(0.45))];
    const sessionId = ++ids.session;
    const openedAt = localTime(day, 15 * 60 + 40 + rng.int(0, 15));
    const openingAmount = isoWeekday(day) >= 5 ? 500 : 300;
    let cashCents = 0;

    const starts = Array.from({ length: tabCount }, () => {
      const hour = rng.weighted(HOUR_WEIGHTS, ([, w]) => w)[0];
      return hour * 60 + rng.int(0, hour === 23 ? 10 : 59);
    }).sort((a, b) => a - b);

    for (const start of starts) {
      const tabId = ++ids.tab;
      const seller = rng.pick(crew);
      const table = rng.chance(0.8) ? rng.pick(tables) : null;
      const tabOpenedAt = localTime(day, start);
      const orderCount = rng.weighted([1, 2, 3], (n) => (n === 1 ? 55 : n === 2 ? 35 : 10));
      let lastSent = tabOpenedAt;
      let subtotalCents = 0;

      for (let o = 0; o < orderCount; o++) {
        const sentAt = addMinutes(lastSent, o === 0 ? rng.int(1, 4) : rng.int(25, 60));
        // Después de las 23:30 ya no se piden rondas: la cuenta se cobra antes de medianoche.
        if (o > 0 && sentAt > localTime(day, 23 * 60 + 30)) break;
        const orderId = ++ids.order;
        lastSent = sentAt;
        rows.orders.push({ id: orderId, tabId, createdById: seller.id, sentAt });
        const lineCount = rng.weighted([1, 2, 3], (n) => (n === 1 ? 45 : n === 2 ? 40 : 15));

        for (let l = 0; l < lineCount; l++) {
          const product = rng.weighted(products, (p) => PRODUCT_WEIGHTS[p.name] ?? 1);
          const quantity = rng.weighted([1, 2, 3], (n) => (n === 1 ? 70 : n === 2 ? 25 : 5));
          const itemId = ++ids.item;
          const consumption = new Map<number, number>();
          const consume = (inventoryItemId: number, qty: number) =>
            consumption.set(inventoryItemId, (consumption.get(inventoryItemId) ?? 0) + qty);
          for (const c of product.recipe) consume(c.inventoryItemId, Number(c.quantity));
          let priceCents = toCents(Number(product.price));

          for (const { group } of product.modifierGroups) {
            const options = group.options.filter((op) => op.active);
            const chosen =
              group.maxSelect > 1
                ? options.filter((op) => rng.chance(MULTI_OPTION_CHANCE[op.name] ?? 0.05))
                : group.minSelect >= 1 || rng.chance(0.75)
                  ? [rng.weighted(options, (op) => OPTION_WEIGHTS[op.name] ?? 1)]
                  : [];
            for (const op of chosen) {
              priceCents += toCents(Number(op.priceDelta));
              for (const c of op.components) consume(c.inventoryItemId, Number(c.quantity));
              rows.modifiers.push({
                id: ++ids.modifier,
                orderItemId: itemId,
                optionId: op.id,
                groupName: group.name,
                optionName: op.name,
                priceDelta: op.priceDelta,
              });
            }
          }

          const unitCost = [...consumption].reduce((s, [id, qty]) => s + qty * cost(id), 0);
          // Una cancelación de vez en cuando (nunca la única línea de la cuenta).
          const cancelled = subtotalCents > 0 && rng.chance(0.03);
          const reason = `Comanda #${orderId} · ${table ? `${table.name} · Cliente 1` : 'Sin mesa'}`;
          const statusChangedAt = addMinutes(sentAt, cancelled ? rng.int(2, 5) : rng.int(6, 15));
          rows.items.push({
            id: itemId,
            tabId,
            orderId,
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice: D(fromCents(priceCents)),
            unitCost: D(Math.round(unitCost * 10_000) / 10_000),
            status: cancelled ? 'CANCELLED' : 'DELIVERED',
            statusChangedAt,
            consumption: [...consumption].map(([inventoryItemId, qty]) => ({
              inventoryItemId,
              quantity: qty,
            })),
            cancelledById: cancelled ? seller.id : null,
            cancelReason: cancelled ? rng.pick(CANCEL_REASONS) : null,
            createdAt: sentAt,
          });
          for (const [id, qty] of consumption) {
            events.push({
              at: sentAt,
              order: 2,
              itemId: id,
              type: 'SALE',
              quantity: -qty * quantity,
              unitCost: cost(id),
              reason,
              userId: seller.id,
              orderItemId: itemId,
            });
            if (cancelled)
              events.push({
                at: statusChangedAt,
                order: 3,
                itemId: id,
                type: 'SALE_VOID',
                quantity: qty * quantity,
                unitCost: cost(id),
                reason: `Cancelado: ${rows.items.at(-1)!.cancelReason}`,
                userId: seller.id,
                orderItemId: itemId,
              });
          }
          if (!cancelled) subtotalCents += priceCents * quantity;
        }
      }

      // ── Cobro ──
      const discount = rng.chance(0.04) ? ({ type: 'PERCENT', value: 10 } as const) : null;
      const serviceRate = table && rng.chance(0.15) ? 10 : null;
      const totals = computeTabTotals(fromCents(subtotalCents), discount, serviceRate);
      const closedAt = new Date(
        Math.max(
          addMinutes(lastSent, 5).getTime(),
          Math.min(
            addMinutes(lastSent, rng.int(20, 70)).getTime(),
            localTime(day, 23 * 60 + 50).getTime(),
          ),
        ),
      );
      rows.tabs.push({
        id: tabId,
        tableId: table?.id ?? null,
        customerName: table ? 'Cliente 1' : rng.pick(WALK_IN_NAMES),
        status: 'PAID',
        discountType: discount?.type ?? null,
        discountValue: discount ? D(discount.value) : null,
        discountReason: discount ? `Cliente frecuente (autorizó ${opts.adminName})` : null,
        serviceChargeRate: serviceRate === null ? null : D(serviceRate),
        subtotal: D(totals.subtotal),
        discountTotal: D(totals.discountTotal),
        serviceCharge: D(totals.serviceCharge),
        total: D(totals.total),
        businessDate: new Date(`${day}T00:00:00.000Z`),
        openedById: seller.id,
        closedById: seller.id,
        openedAt: tabOpenedAt,
        closedAt,
      });

      const pay = (method: 'CASH' | 'CARD', amountCents: number, at: Date) => {
        const amount = fromCents(amountCents);
        let tendered: number | null = null;
        if (method === 'CASH') {
          const bills = suggestedBills(amount);
          tendered = rng.weighted(bills.slice(0, 3), (b) => (b === amount ? 35 : 30));
          cashCents += amountCents;
        }
        rows.payments.push({
          id: ++ids.payment,
          tabId,
          cashSessionId: sessionId,
          method,
          amount: D(amount),
          tendered: tendered === null ? null : D(tendered),
          change: tendered === null ? null : D(fromCents(toCents(tendered) - amountCents)),
          reference: method === 'CARD' ? String(rng.int(100000, 999999)) : null,
          receivedById: seller.id,
          businessDate: new Date(`${day}T00:00:00.000Z`),
          createdAt: at,
        });
      };
      const totalCents = toCents(totals.total);
      const r = rng.next();
      if (r < 0.62) pay('CASH', totalCents, closedAt);
      else if (r < 0.92) pay('CARD', totalCents, closedAt);
      else {
        const half = Math.floor(totalCents / 2);
        pay('CARD', half, addMinutes(closedAt, -2));
        pay('CASH', totalCents - half, closedAt);
      }
    }

    // ── Caja del día ──
    let movesCents = 0;
    if (rng.chance(0.3)) {
      const amount = rng.pick([25, 30, 40]);
      movesCents -= toCents(amount);
      rows.cashMoves.push({
        id: ++ids.cashMove,
        cashSessionId: sessionId,
        type: 'OUT',
        amount: D(amount),
        reason: 'Compra de hielo',
        userId: opener.id,
        createdAt: localTime(day, 18 * 60 + rng.int(0, 120)),
      });
    }
    if (rng.chance(0.1)) {
      movesCents += 10_000;
      rows.cashMoves.push({
        id: ++ids.cashMove,
        cashSessionId: sessionId,
        type: 'IN',
        amount: D(100),
        reason: 'Cambio en sencillo',
        userId: opener.id,
        createdAt: localTime(day, 17 * 60 + rng.int(0, 60)),
      });
    }
    const expected = toCents(openingAmount) + cashCents + movesCents;
    const diff = rng.weighted([0, -500, -1000, 500, 1000, -2000], (d) => (d === 0 ? 80 : 4));
    rows.sessions.push({
      id: sessionId,
      status: 'CLOSED',
      openingAmount: D(openingAmount),
      expectedCash: D(fromCents(expected)),
      countedCash: D(fromCents(expected + diff)),
      difference: D(fromCents(diff)),
      notes: diff < 0 ? 'No cuadró, se revisará con el turno' : null,
      openedById: opener.id,
      closedById: opener.id,
      openedAt,
      closedAt: localTime(day, 23 * 60 + 55),
    });

    // ── Mermas: una o dos por semana ──
    if (rng.chance(0.2)) {
      const [name, qty, reason] = rng.pick(WASTES);
      const item = itemByName.get(name)!;
      events.push({
        at: localTime(day, 17 * 60 + rng.int(0, 240)),
        order: 3,
        itemId: item.id,
        type: 'WASTE',
        quantity: -qty,
        unitCost: cost(item.id),
        reason,
        userId: opener.id,
      });
    }
  }

  // ── Compras: las de ejemplo y una por proveedor cada lunes, según lo que se consumirá ──
  interface PlannedLine {
    itemId: number;
    quantity: number;
    /** Total de la línea; si falta, cantidad × costo. */
    total?: number;
  }
  interface PlannedPurchase {
    supplier: string;
    date: string;
    at: Date;
    invoice: string | null;
    lines: PlannedLine[];
    sample: boolean;
  }
  const purchases: PlannedPurchase[] = opts.samplePurchases.map((p) => {
    const date = addDays(today, -p.daysAgo);
    return {
      supplier: p.supplier,
      date,
      at: localTime(date, 10 * 60),
      invoice: p.invoice,
      lines: p.lines.map(([name, quantity, total]) => ({
        itemId: itemByName.get(name)!.id,
        quantity,
        total,
      })),
      sample: true,
    };
  });
  const mondays: string[] = [];
  for (let d = addDays(firstDay, 1); d < today; d = addDays(d, 1))
    if (isoWeekday(d) === 1) mondays.push(d);

  const startAt = localTime(addDays(firstDay, -1), 10 * 60);
  const initial = new Map<number, number>();
  const weekly = new Map<string, Map<number, PlannedLine>>(); // lunes → artículo → línea
  for (const m of mondays) weekly.set(m, new Map());

  const byItem = (itemId: number) => {
    const list: { at: number; qty: number }[] = events
      .filter((e) => e.itemId === itemId)
      .map((e) => ({ at: e.at.getTime(), qty: e.quantity }));
    for (const p of purchases)
      for (const l of p.lines)
        if (l.itemId === itemId) list.push({ at: p.at.getTime(), qty: l.quantity });
    for (const [m, lines] of weekly) {
      const l = lines.get(itemId);
      if (l?.quantity) list.push({ at: localTime(m, 11 * 60).getTime(), qty: l.quantity });
    }
    return list.sort((a, b) => a.at - b.at);
  };
  /** Stock final y mínimo desde un instante, con el stock inicial dado. */
  const simulate = (itemId: number, start: number, from = 0) => {
    let stock = start;
    let min = from <= startAt.getTime() ? start : Infinity;
    for (const e of byItem(itemId)) {
      stock += e.qty;
      if (e.at >= from) min = Math.min(min, stock);
    }
    return { final: stock, min: Math.min(min, stock) };
  };

  for (const item of items) {
    const supply = SUPPLY[item.name];
    const pack = supply?.[1] ?? 1;
    const target = Number(item.stock);
    const own = events.filter((e) => e.itemId === item.id);
    const consumedBefore = (at: number) =>
      -own.filter((e) => e.at.getTime() < at).reduce((s, e) => s + e.quantity, 0);
    const fixedBefore = (at: number) =>
      purchases
        .flatMap((p) =>
          p.lines
            .filter((l) => l.itemId === item.id)
            .map((l) => ({ at: p.at.getTime(), q: l.quantity })),
        )
        .filter((x) => x.at < at)
        .reduce((s, x) => s + x.q, 0);

    // Stock inicial: lo que se consume antes del primer lunes, redondeado a la presentación.
    const firstMonday = mondays[0] ? localTime(mondays[0], 11 * 60).getTime() : Infinity;
    let start =
      Math.ceil(Math.max(0, consumedBefore(firstMonday) - fixedBefore(firstMonday)) / pack) * pack;
    // Cada lunes se compra lo necesario para cubrir la semana (en presentaciones completas).
    let bought = 0;
    for (const [i, m] of supply ? mondays.entries() : []) {
      const at = localTime(m, 11 * 60).getTime();
      const next = mondays[i + 1] ? localTime(mondays[i + 1]!, 11 * 60).getTime() : Infinity;
      const stockNow = start + bought + fixedBefore(at) - consumedBefore(at);
      const need =
        consumedBefore(next) - consumedBefore(at) - (fixedBefore(next) - fixedBefore(at));
      const qty = need > stockNow ? Math.ceil((need - stockNow) / pack) * pack : 0;
      if (qty > 0) weekly.get(m)!.set(item.id, { itemId: item.id, quantity: qty });
      bought += qty;
    }

    // Ajuste para terminar exactamente en el stock de la lista del seed.
    let { final, min } = simulate(item.id, start);
    if (final < target) start += target - final;
    else if (final > target) {
      let surplus = round3(final - target);
      const cut = Math.min(surplus, min);
      start -= cut;
      surplus = round3(surplus - cut);
      for (const m of [...mondays].reverse()) {
        if (surplus <= 0) break;
        const line = weekly.get(m)!.get(item.id);
        if (!line) continue;
        const after = simulate(item.id, start, localTime(m, 11 * 60).getTime()).min;
        const reduce = Math.min(surplus, line.quantity, after);
        line.quantity = round3(line.quantity - reduce);
        surplus = round3(surplus - reduce);
      }
      ({ final } = simulate(item.id, start));
      if (Math.abs(final - target) > 0.001)
        console.warn(`   ⚠ ${item.name}: el stock final simulado es ${final}, no ${target}`);
    }
    ({ min } = simulate(item.id, start));
    if (min < -0.001) throw new Error(`El historial deja ${item.name} en negativo (${min})`);
    initial.set(item.id, round3(start));
  }

  for (const [m, lines] of weekly) {
    const bySupplier = new Map<string, PlannedLine[]>();
    for (const line of lines.values()) {
      if (line.quantity <= 0) continue;
      const supplier = SUPPLY[itemById.get(line.itemId)!.name]![0];
      bySupplier.set(supplier, [...(bySupplier.get(supplier) ?? []), line]);
    }
    for (const [supplier, list] of bySupplier)
      purchases.push({
        supplier,
        date: m,
        at: localTime(m, 11 * 60),
        invoice: null,
        lines: list,
        sample: false,
      });
  }
  purchases.sort((a, b) => a.at.getTime() - b.at.getTime() || a.supplier.localeCompare(b.supplier));

  // ── Escritura ──
  let purchaseId = 0;
  let purchaseItemId = 0;
  let invoice = 10180;
  const purchaseRows: Prisma.PurchaseCreateManyInput[] = [];
  const purchaseItemRows: Prisma.PurchaseItemCreateManyInput[] = [];
  for (const p of purchases) {
    const id = ++purchaseId;
    const number =
      p.invoice ?? (p.supplier === 'Cervecería Centro Americana' ? `A-${++invoice}` : null);
    let totalCents = 0;
    for (const l of p.lines) {
      const c = cost(l.itemId);
      const subtotal = l.total ?? fromCents(Math.max(1, toCents(l.quantity * c)));
      totalCents += toCents(subtotal);
      const unitCost = Math.round((subtotal / l.quantity) * 10_000) / 10_000;
      const lineId = ++purchaseItemId;
      purchaseItemRows.push({
        id: lineId,
        purchaseId: id,
        inventoryItemId: l.itemId,
        quantity: D(l.quantity),
        unitCost: D(unitCost),
        subtotal: D(subtotal),
      });
      events.push({
        at: p.at,
        order: 1,
        itemId: l.itemId,
        type: 'PURCHASE',
        quantity: l.quantity,
        unitCost,
        reason: `Compra #${id} · ${p.supplier}${number ? ` · factura ${number}` : ''}`,
        userId: opts.adminId,
        purchaseItemId: lineId,
      });
    }
    purchaseRows.push({
      id,
      supplierId: supplierId(p.supplier),
      purchasedAt: new Date(`${p.date}T00:00:00.000Z`),
      invoiceNumber: number,
      total: D(fromCents(totalCents)),
      createdById: opts.adminId,
      createdAt: p.at,
    });
  }

  for (const [itemId, qty] of initial)
    if (qty > 0)
      events.push({
        at: startAt,
        order: 0,
        itemId,
        type: 'INITIAL',
        quantity: qty,
        unitCost: cost(itemId),
        reason: 'Stock inicial',
        userId: opts.adminId,
      });

  events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);
  const running = new Map<number, number>();
  const movementRows: Prisma.InventoryMovementCreateManyInput[] = events.map((e) => {
    const after = round3((running.get(e.itemId) ?? 0) + e.quantity);
    running.set(e.itemId, after);
    return {
      inventoryItemId: e.itemId,
      type: e.type,
      quantity: D(round3(e.quantity)),
      unitCost: D(e.unitCost),
      stockAfter: D(after),
      reason: e.reason,
      userId: e.userId,
      purchaseItemId: e.purchaseItemId ?? null,
      orderItemId: e.orderItemId ?? null,
      createdAt: e.at,
    };
  });

  const chunked = async <T>(list: T[], write: (chunk: T[]) => Promise<unknown>) => {
    for (let i = 0; i < list.length; i += 2000) await write(list.slice(i, i + 2000));
  };
  await prisma.purchase.createMany({ data: purchaseRows });
  await prisma.purchaseItem.createMany({ data: purchaseItemRows });
  await prisma.cashSession.createMany({ data: rows.sessions });
  await prisma.cashMovement.createMany({ data: rows.cashMoves });
  await chunked(rows.tabs, (data) => prisma.tab.createMany({ data }));
  await chunked(rows.orders, (data) => prisma.order.createMany({ data }));
  await chunked(rows.items, (data) => prisma.orderItem.createMany({ data }));
  await chunked(rows.modifiers, (data) => prisma.orderItemModifier.createMany({ data }));
  await chunked(rows.payments, (data) => prisma.payment.createMany({ data }));
  await chunked(movementRows, (data) => prisma.inventoryMovement.createMany({ data }));

  // Con ids explícitos, las secuencias quedan atrás: se adelantan al último id usado.
  for (const table of [
    'Purchase',
    'PurchaseItem',
    'CashSession',
    'CashMovement',
    'Tab',
    'Order',
    'OrderItem',
    'OrderItemModifier',
    'Payment',
  ])
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST((SELECT MAX(id) FROM "${table}"), 1))`,
    );

  // El stock guardado es el que resulta de los movimientos.
  for (const [itemId, stock] of running)
    await prisma.inventoryItem.update({ where: { id: itemId }, data: { stock: D(stock) } });

  return {
    days: opts.days,
    tabs: rows.tabs.length,
    purchases: purchaseRows.length,
    movements: movementRows.length,
  };
}
