import { z } from 'zod';
import { INVENTORY_KINDS, MOVEMENT_TYPES, UNITS } from '../constants';
import {
  businessDateSchema,
  queryBoolean,
  quantitySchema,
  stockSchema,
  unitCostSchema,
} from './numbers';

const name = z
  .string({ error: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(60, 'El nombre no puede tener más de 60 caracteres');
const kind = z.enum(INVENTORY_KINDS, { error: 'Elige si es insumo o reventa' });
const unit = z.enum(UNITS, { error: 'Elige la unidad' });

export const inventoryItemCreateSchema = z.object({
  name,
  kind,
  unit,
  minStock: stockSchema('El stock mínimo'),
  initialStock: stockSchema('El stock inicial').default(0),
  initialCost: unitCostSchema('El costo por unidad').default(0),
});
export type InventoryItemCreateInput = z.input<typeof inventoryItemCreateSchema>;

export const inventoryItemUpdateSchema = z
  .object({ name, kind, unit, minStock: stockSchema('El stock mínimo'), active: z.boolean() })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');
export type InventoryItemUpdateInput = z.input<typeof inventoryItemUpdateSchema>;

const reason = z.string().trim().max(200, 'El motivo no puede tener más de 200 caracteres');

export const movementInputSchema = z.discriminatedUnion(
  'type',
  [
    z.object({
      type: z.literal('MANUAL_IN'),
      quantity: quantitySchema(),
      /** Si se indica, actualiza el costo promedio. */
      unitCost: unitCostSchema('El costo por unidad').optional(),
      reason: reason.optional(),
    }),
    z.object({
      type: z.literal('WASTE'),
      quantity: quantitySchema(),
      reason: reason.min(3, 'Indica el motivo de la salida (ej. se quebró, vencido)'),
    }),
    z.object({
      type: z.literal('ADJUSTMENT'),
      /** Lo que hay físicamente según el conteo. */
      countedStock: stockSchema('El conteo'),
      reason: reason.optional(),
    }),
  ],
  { error: 'Elige el tipo de movimiento' },
);
export type MovementInput = z.input<typeof movementInputSchema>;

export const inventoryListQuerySchema = z.object({
  kind: kind.optional(),
  alert: queryBoolean.optional(),
  includeInactive: queryBoolean.optional(),
  q: z.string().trim().max(60).optional(),
});

export const movementsQuerySchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  type: z.enum(MOVEMENT_TYPES, { error: 'Tipo de movimiento no válido' }).optional(),
  from: businessDateSchema.optional(),
  to: businessDateSchema.optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MovementsQuery = z.output<typeof movementsQuerySchema>;
