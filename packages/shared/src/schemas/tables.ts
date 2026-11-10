import { z } from 'zod';

const tableName = z
  .string({ error: 'El nombre es obligatorio' })
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(30, 'El nombre no puede tener más de 30 caracteres');

/** Zona opcional (Salón, Terraza, Barra…): agrupa las mesas en el POS. */
const zone = z
  .string()
  .trim()
  .max(30, 'La zona no puede tener más de 30 caracteres')
  .nullish()
  .transform((v) => (v ? v : null));

export const tableInputSchema = z.object({
  name: tableName,
  zone,
  active: z.boolean().optional(),
});
export type TableInput = z.input<typeof tableInputSchema>;

export const tableUpdateSchema = tableInputSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');
export type TableUpdateInput = z.input<typeof tableUpdateSchema>;

/** Varias mesas de una vez: "Mesa 1" … "Mesa 12". */
export const tableBulkSchema = z.object({
  prefix: z
    .string({ error: 'Indica cómo se llaman' })
    .trim()
    .min(1, 'Indica cómo se llaman (ej. Mesa)')
    .max(20, 'El nombre no puede tener más de 20 caracteres'),
  start: z
    .number({ error: 'Indica el primer número' })
    .int('Usa un número entero')
    .min(1, 'El primer número es 1 o más')
    .max(999, 'El primer número no puede pasar de 999'),
  count: z
    .number({ error: 'Indica cuántas mesas' })
    .int('Usa un número entero')
    .min(1, 'Agrega al menos 1 mesa')
    .max(50, 'Máximo 50 mesas a la vez'),
  zone,
});
export type TableBulkInput = z.input<typeof tableBulkSchema>;
