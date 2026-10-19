import { z } from 'zod';
import { intIdSchema } from './numbers';

const customerName = z
  .string({ error: 'Escribe el nombre del cliente' })
  .trim()
  .min(1, 'Escribe el nombre del cliente')
  .max(40, 'El nombre no puede tener más de 40 caracteres');

/** Con mesa el nombre es opcional ("Cliente 2"); sin mesa es obligatorio. */
export const openTabSchema = z
  .object({
    tableId: z.number().int().positive().nullable().default(null),
    customerName: customerName.optional(),
  })
  .refine((d) => d.tableId !== null || !!d.customerName, {
    path: ['customerName'],
    message: 'Escribe el nombre del cliente',
  });
export type OpenTabInput = z.input<typeof openTabSchema>;

export const updateTabSchema = z
  .object({
    customerName,
    /** null = pasa a ser cliente sin mesa. */
    tableId: z.number().int().positive().nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');
export type UpdateTabInput = z.input<typeof updateTabSchema>;

export const orderLineSchema = z.object({
  productId: intIdSchema('un producto'),
  quantity: z
    .number({ error: 'Indica la cantidad' })
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima es 1')
    .max(99, 'La cantidad máxima por línea es 99'),
  note: z
    .string()
    .trim()
    .max(120, 'La nota no puede tener más de 120 caracteres')
    .nullish()
    .transform((v) => (v ? v : null)),
  modifierOptionIds: z.array(z.number().int().positive()).max(20).default([]),
});
export type OrderLineInput = z.input<typeof orderLineSchema>;

export const sendOrderSchema = z.object({
  items: z
    .array(orderLineSchema)
    .min(1, 'La orden está vacía')
    .max(50, 'Máximo 50 líneas por envío'),
});
export type SendOrderInput = z.input<typeof sendOrderSchema>;

export const ITEM_FLOW = ['PENDING', 'PREPARING', 'DELIVERED'] as const;
export type ItemFlowStatus = (typeof ITEM_FLOW)[number];

export const itemStatusSchema = z.object({
  status: z.enum(ITEM_FLOW, { error: 'Estado no válido' }),
});

export const advanceOrderSchema = z.object({
  to: z.enum(['PREPARING', 'DELIVERED'], { error: 'Estado no válido' }),
});

export const cancelItemSchema = z.object({
  reason: z
    .string({ error: 'Indica el motivo' })
    .trim()
    .min(3, 'Indica el motivo (ej. el cliente cambió de opinión)')
    .max(120, 'El motivo no puede tener más de 120 caracteres'),
  /** Cuántas unidades cancelar; por defecto toda la línea. */
  quantity: z.number().int().min(1, 'La cantidad mínima es 1').optional(),
  /** PIN de un administrador, necesario si el ítem ya se está preparando o se entregó. */
  authorizationPin: z
    .string()
    .regex(/^\d{4,6}$/, 'El PIN debe tener de 4 a 6 dígitos')
    .optional(),
});
export type CancelItemInput = z.input<typeof cancelItemSchema>;

export const cancelTabSchema = z.object({
  reason: z.string().trim().max(120).optional(),
});
