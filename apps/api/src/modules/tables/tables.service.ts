import type { Prisma } from '@prisma/client';
import {
  tableBulkSchema,
  tableInputSchema,
  tableUpdateSchema,
  type DiningTableDto,
  type TableBulkInput,
  type TableInput,
  type TableUpdateInput,
} from '@sanfefer/shared';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

const counts = {
  _count: { select: { tabs: true } },
  tabs: { where: { status: 'OPEN' }, select: { id: true } },
} satisfies Prisma.DiningTableInclude;

type Row = Prisma.DiningTableGetPayload<{ include: typeof counts }>;

const toDto = (t: Row): DiningTableDto => ({
  id: t.id,
  name: t.name,
  zone: t.zone,
  sortOrder: t.sortOrder,
  active: t.active,
  openTabs: t.tabs.length,
  hasHistory: t._count.tabs > 0,
});

export async function listTables() {
  const rows = await prisma.diningTable.findMany({
    include: counts,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toDto);
}

async function getOrThrow(id: number) {
  const t = await prisma.diningTable.findUnique({ where: { id }, include: counts });
  if (!t) throw notFound('La mesa no existe.');
  return t;
}

/** Los nombres no distinguen mayúsculas: "mesa 1" y "Mesa 1" serían la misma mesa en el POS. */
async function assertNameFree(name: string, exceptId?: number) {
  const same = await prisma.diningTable.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      NOT: exceptId ? { id: exceptId } : undefined,
    },
  });
  if (same)
    throw new AppError(409, 'DUPLICATE', `Ya existe una mesa llamada ${same.name}.`, {
      name: 'Ya existe una mesa con ese nombre',
    });
}

const nextSortOrder = async () =>
  ((await prisma.diningTable.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;

export async function createTable(input: TableInput) {
  const data = tableInputSchema.parse(input);
  await assertNameFree(data.name);
  const t = await prisma.diningTable.create({
    data: { ...data, sortOrder: await nextSortOrder() },
    include: counts,
  });
  return toDto(t);
}

/** Crea "Mesa 1" … "Mesa N"; las que ya existen con ese nombre se saltan. */
export async function createTables(input: TableBulkInput) {
  const { prefix, start, count, zone } = tableBulkSchema.parse(input);
  const names = Array.from({ length: count }, (_, i) => `${prefix} ${start + i}`);
  const existing = await prisma.diningTable.findMany({
    where: { OR: names.map((n) => ({ name: { equals: n, mode: 'insensitive' as const } })) },
    select: { name: true },
  });
  const taken = new Set(existing.map((e) => e.name.toLowerCase()));
  const fresh = names.filter((n) => !taken.has(n.toLowerCase()));
  let sortOrder = await nextSortOrder();
  await prisma.diningTable.createMany({
    data: fresh.map((name) => ({ name, zone, sortOrder: sortOrder++ })),
  });
  return { created: fresh, skipped: names.filter((n) => taken.has(n.toLowerCase())) };
}

export async function updateTable(id: number, input: TableUpdateInput) {
  const data = tableUpdateSchema.parse(input);
  const t = await getOrThrow(id);
  if (data.name !== undefined) await assertNameFree(data.name, id);
  if (data.active === false && t.tabs.length > 0) {
    throw conflict(
      `${t.name} tiene ${t.tabs.length} cuenta${t.tabs.length === 1 ? '' : 's'} abierta${t.tabs.length === 1 ? '' : 's'}. Cóbralas o muévelas a otra mesa antes de desactivarla.`,
    );
  }
  return toDto(await prisma.diningTable.update({ where: { id }, data, include: counts }));
}

export async function deleteTable(id: number) {
  const t = await getOrThrow(id);
  // Las cuentas cobradas guardan su mesa: borrarla dejaría el historial y los reportes sin ella.
  if (t._count.tabs > 0) {
    throw conflict(
      `${t.name} tiene cuentas en el historial, así que no se puede borrar. Desactívala para que ya no salga en el POS.`,
    );
  }
  await prisma.diningTable.delete({ where: { id } });
}

export async function reorderTables(ids: number[]) {
  const count = await prisma.diningTable.count({ where: { id: { in: ids } } });
  if (count !== ids.length) throw badRequest('Algunas mesas ya no existen. Recarga la página.');
  await prisma.$transaction(
    ids.map((id, sortOrder) => prisma.diningTable.update({ where: { id }, data: { sortOrder } })),
  );
  return listTables();
}
