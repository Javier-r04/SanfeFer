import { z } from 'zod';
import { businessDateSchema, decimal, queryBoolean } from './numbers';

const money = (label: string, min = 0, minExclusive = false) =>
  decimal(label, { min, max: 999999.99, places: 2, minExclusive });
const notes = z
  .string()
  .trim()
  .max(200, 'Las notas no pueden tener más de 200 caracteres')
  .nullish()
  .transform((v) => (v ? v : null));

export const openCashSchema = z.object({
  openingAmount: money('El fondo inicial'),
  notes,
});
export type OpenCashInput = z.input<typeof openCashSchema>;

export const cashMovementSchema = z.object({
  type: z.enum(['IN', 'OUT'], { error: 'Indica si es entrada o salida' }),
  amount: money('El monto', 0, true),
  reason: z
    .string({ error: 'Indica el motivo' })
    .trim()
    .min(3, 'Indica el motivo (ej. pago a proveedor, cambio)')
    .max(120, 'El motivo no puede tener más de 120 caracteres'),
});
export type CashMovementInput = z.input<typeof cashMovementSchema>;

export const closeCashSchema = z.object({
  countedCash: money('El efectivo contado'),
  notes,
});
export type CloseCashInput = z.input<typeof closeCashSchema>;

export const cashSessionsQuerySchema = z.object({
  from: businessDateSchema.optional(),
  to: businessDateSchema.optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type CashSessionsQuery = z.output<typeof cashSessionsQuerySchema>;

export const dailyQuerySchema = z.object({
  date: businessDateSchema.optional(),
  includeItems: queryBoolean.optional(),
});
