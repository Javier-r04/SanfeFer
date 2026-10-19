import { z } from 'zod';
import { decimal } from './numbers';

const pin = z
  .string()
  .regex(/^\d{4,6}$/, 'El PIN debe tener de 4 a 6 dígitos')
  .optional();

/** Descuento y cargo por servicio de una cuenta. Enviar `discount: null` lo quita. */
export const tabChargesSchema = z
  .object({
    discount: z
      .object({
        type: z.enum(['PERCENT', 'AMOUNT'], { error: 'Elige porcentaje o monto' }),
        value: decimal('El descuento', { min: 0, max: 99999.99, places: 2, minExclusive: true }),
        reason: z
          .string({ error: 'Indica el motivo del descuento' })
          .trim()
          .min(3, 'Indica el motivo del descuento')
          .max(120, 'El motivo no puede tener más de 120 caracteres'),
      })
      .refine((d) => d.type !== 'PERCENT' || d.value <= 100, {
        path: ['value'],
        message: 'El porcentaje no puede ser mayor que 100',
      })
      .nullable(),
    serviceChargeRate: decimal('El cargo por servicio', {
      min: 0,
      max: 30,
      places: 2,
      minExclusive: true,
    }).nullable(),
    /** PIN de un admin: necesario cuando un vendedor aplica un descuento. */
    authorizationPin: pin,
  })
  .partial()
  .refine(
    (d) => d.discount !== undefined || d.serviceChargeRate !== undefined,
    'No hay cambios para guardar',
  );
export type TabChargesInput = z.input<typeof tabChargesSchema>;

export const paymentSchema = z
  .object({
    method: z.enum(['CASH', 'CARD'], { error: 'Elige efectivo o tarjeta' }),
    amount: decimal('El monto', { min: 0, max: 999999.99, places: 2, minExclusive: true }),
    /** Efectivo recibido (solo efectivo); si falta se asume el monto exacto. */
    tendered: decimal('El efectivo recibido', { min: 0, max: 999999.99, places: 2 }).optional(),
    reference: z
      .string()
      .trim()
      .max(40, 'La referencia no puede tener más de 40 caracteres')
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .refine((p) => p.method !== 'CASH' || p.tendered === undefined || p.tendered >= p.amount, {
    path: ['tendered'],
    message: 'El efectivo recibido no alcanza para el monto',
  });
export type PaymentInput = z.input<typeof paymentSchema>;

export const moveItemsSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.number().int().positive(),
          quantity: z
            .number({ error: 'Indica la cantidad' })
            .int()
            .min(1, 'La cantidad mínima es 1'),
        }),
      )
      .min(1, 'Elige al menos un producto'),
    targetTabId: z.number().int().positive().optional(),
    /** Crear una cuenta nueva (dividir por productos). */
    newTab: z
      .object({
        tableId: z.number().int().positive().nullable(),
        customerName: z.string().trim().min(1).max(40).optional(),
      })
      .optional(),
  })
  .refine((d) => (d.targetTabId === undefined) !== (d.newTab === undefined), {
    path: ['targetTabId'],
    message: 'Elige a qué cuenta mover los productos',
  })
  .refine((d) => !d.newTab || d.newTab.tableId !== null || !!d.newTab.customerName, {
    path: ['newTab', 'customerName'],
    message: 'Escribe el nombre del cliente',
  });
export type MoveItemsInput = z.input<typeof moveItemsSchema>;
