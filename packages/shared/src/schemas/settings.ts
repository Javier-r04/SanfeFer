import { z } from 'zod';
import { decimal } from './numbers';

const optional = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede tener más de ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

export const PAPER_WIDTHS = [58, 80] as const;
export type PaperWidth = (typeof PAPER_WIDTHS)[number];

export const settingsSchema = z
  .object({
    businessName: z
      .string({ error: 'El nombre del negocio es obligatorio' })
      .trim()
      .min(2, 'El nombre del negocio debe tener al menos 2 caracteres')
      .max(60, 'El nombre no puede tener más de 60 caracteres'),
    address: optional('La dirección', 120),
    phone: optional('El teléfono', 30),
    taxId: optional('El NIT', 20),
    ticketFooter: optional('El pie del ticket', 120),
    serviceChargeRate: decimal('El cargo por servicio', { min: 0, max: 30, places: 2 }),
    serviceChargeByDefault: z.boolean(),
    allowNegativeStock: z.boolean(),
    paperWidth: z.union([z.literal(58), z.literal(80)], { error: 'Elige 58 u 80 mm' }),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');
export type SettingsInput = z.input<typeof settingsSchema>;
