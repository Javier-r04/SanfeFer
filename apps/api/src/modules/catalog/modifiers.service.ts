import { Prisma } from '@prisma/client';
import { modifierGroupInputSchema, type ModifierGroupInput } from '@sanfefer/shared';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { modifierGroupInclude, toModifierGroupDto } from './catalog.mapper';
import { assertRecipeItems } from './catalog.validation';

const D = (v: number) => new Prisma.Decimal(v);

export async function listModifierGroups() {
  const rows = await prisma.modifierGroup.findMany({
    include: modifierGroupInclude,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toModifierGroupDto);
}

async function getOrThrow(id: number) {
  const g = await prisma.modifierGroup.findUnique({ where: { id }, include: modifierGroupInclude });
  if (!g) throw notFound('El grupo de extras no existe.');
  return g;
}

export async function getModifierGroup(id: number) {
  return toModifierGroupDto(await getOrThrow(id));
}

type ParsedGroup = ReturnType<typeof modifierGroupInputSchema.parse>;

async function assertOptionsComponents(input: ParsedGroup) {
  for (const [i, option] of input.options.entries()) {
    await assertRecipeItems(option.components, `options.${i}.components`);
  }
}

const componentsData = (components: ParsedGroup['options'][number]['components']) =>
  components.map((c) => ({ inventoryItemId: c.inventoryItemId, quantity: D(c.quantity) }));

export async function createModifierGroup(raw: ModifierGroupInput) {
  const input = modifierGroupInputSchema.parse(raw);
  await assertOptionsComponents(input);
  const last = await prisma.modifierGroup.aggregate({ _max: { sortOrder: true } });
  const g = await prisma.modifierGroup.create({
    data: {
      name: input.name,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
      active: input.active,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
      options: {
        create: input.options.map((o, sortOrder) => ({
          name: o.name,
          priceDelta: D(o.priceDelta),
          active: o.active,
          sortOrder,
          components: { create: componentsData(o.components) },
        })),
      },
    },
    include: modifierGroupInclude,
  });
  return toModifierGroupDto(g);
}

/** Reemplaza el grupo completo: las opciones con id se actualizan, las nuevas se crean y las que faltan se borran. */
export async function updateModifierGroup(id: number, raw: ModifierGroupInput) {
  const input = modifierGroupInputSchema.parse(raw);
  const current = await getOrThrow(id);
  const currentIds = new Set(current.options.map((o) => o.id));
  input.options.forEach((o, i) => {
    if (o.id !== undefined && !currentIds.has(o.id)) {
      throw badRequest('Una opción no pertenece a este grupo. Recarga la página.', {
        [`options.${i}.name`]: 'Esta opción no pertenece al grupo',
      });
    }
  });
  await assertOptionsComponents(input);

  const keep = new Set(input.options.flatMap((o) => (o.id ? [o.id] : [])));
  await prisma.$transaction(async (tx) => {
    await tx.modifierGroup.update({
      where: { id },
      data: {
        name: input.name,
        minSelect: input.minSelect,
        maxSelect: input.maxSelect,
        active: input.active,
      },
    });
    // Las ventas guardan copia del nombre y precio del extra, así que borrar una opción no altera el historial.
    await tx.modifierOption.deleteMany({ where: { groupId: id, id: { notIn: [...keep] } } });
    for (const [sortOrder, o] of input.options.entries()) {
      const data = { name: o.name, priceDelta: D(o.priceDelta), active: o.active, sortOrder };
      if (o.id) {
        await tx.modifierOption.update({ where: { id: o.id }, data });
        await tx.modifierOptionComponent.deleteMany({ where: { optionId: o.id } });
        await tx.modifierOptionComponent.createMany({
          data: componentsData(o.components).map((c) => ({ ...c, optionId: o.id! })),
        });
      } else {
        await tx.modifierOption.create({
          data: { ...data, groupId: id, components: { create: componentsData(o.components) } },
        });
      }
    }
  });
  return getModifierGroup(id);
}

export async function setModifierGroupActive(id: number, active: boolean) {
  await getOrThrow(id);
  await prisma.modifierGroup.update({ where: { id }, data: { active } });
  return getModifierGroup(id);
}

export async function deleteModifierGroup(id: number) {
  const g = await getOrThrow(id);
  if (g._count.products > 0) {
    throw conflict(
      `Lo ${g._count.products === 1 ? 'usa 1 producto' : `usan ${g._count.products} productos`}. Quítalo de esos productos o desactívalo.`,
    );
  }
  await prisma.modifierGroup.delete({ where: { id } });
}
