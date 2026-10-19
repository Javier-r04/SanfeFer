import { z } from 'zod';
import { getBusinessDate } from '../business-date';
import { businessDateSchema, decimal, intIdSchema, queryBoolean, quantitySchema } from './numbers';

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede tener más de ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

// ───────────── Proveedores ─────────────

const supplierFields = {
  name: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede tener más de 80 caracteres'),
  contactName: optionalText('El contacto', 60),
  phone: z
    .string()
    .trim()
    .max(30, 'El teléfono no puede tener más de 30 caracteres')
    .regex(/^[\d\s+()-]*$/, 'El teléfono solo puede tener números, espacios y + ( ) -')
    .nullish()
    .transform((v) => (v ? v : null)),
  email: z
    .union([z.literal(''), z.email('El correo no es válido').max(120)])
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null)),
  taxId: optionalText('El NIT', 20),
  notes: optionalText('Las notas', 300),
  active: z.boolean(),
};

export const supplierInputSchema = z.object({
  ...supplierFields,
  active: supplierFields.active.default(true),
});
export type SupplierInput = z.input<typeof supplierInputSchema>;

export const supplierUpdateSchema = z
  .object(supplierFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');
export type SupplierUpdateInput = z.input<typeof supplierUpdateSchema>;

// ───────────── Compras ─────────────

/** Total de la línea tal como aparece en la factura; el costo por unidad se deriva. */
export const lineTotalSchema = decimal('El total de la línea', {
  min: 0,
  max: 999999.99,
  places: 2,
});

export const purchaseLineSchema = z.object({
  inventoryItemId: intIdSchema('un artículo'),
  quantity: quantitySchema(),
  lineTotal: lineTotalSchema,
});
export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;

export const purchaseInputSchema = z.object({
  supplierId: intIdSchema('un proveedor'),
  purchasedAt: businessDateSchema.refine(
    (d) => d <= getBusinessDate(),
    'La fecha de la compra no puede ser futura',
  ),
  invoiceNumber: optionalText('El número de factura', 40),
  notes: optionalText('Las notas', 300),
  items: z
    .array(purchaseLineSchema)
    .min(1, 'Agrega al menos un artículo')
    .max(60, 'Máximo 60 líneas por compra')
    .superRefine((lines, ctx) => {
      const seen = new Set<number>();
      lines.forEach((l, i) => {
        if (seen.has(l.inventoryItemId)) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'inventoryItemId'],
            message: 'Este artículo ya está en la compra; súmalo en una sola línea',
          });
        }
        seen.add(l.inventoryItemId);
      });
    }),
});
export type PurchaseInput = z.input<typeof purchaseInputSchema>;

export const voidPurchaseSchema = z.object({
  reason: z
    .string({ error: 'Indica el motivo de la anulación' })
    .trim()
    .min(3, 'Indica el motivo de la anulación')
    .max(200, 'El motivo no puede tener más de 200 caracteres'),
});

export const purchasesQuerySchema = z.object({
  supplierId: z.coerce.number().int().positive().optional(),
  status: z.enum(['RECEIVED', 'VOIDED'], { error: 'Estado no válido' }).optional(),
  from: businessDateSchema.optional(),
  to: businessDateSchema.optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type PurchasesQuery = z.output<typeof purchasesQuerySchema>;

export const suppliersQuerySchema = z.object({ includeInactive: queryBoolean.optional() });

/** Costo por unidad base a partir del total de la línea (4 decimales, como se guarda). */
export const unitCostFromLine = (lineTotal: number, quantity: number) =>
  quantity > 0 ? Math.round((lineTotal / quantity) * 10000) / 10000 : 0;
