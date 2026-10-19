import { z } from 'zod';

const hasMaxDecimals = (value: number, places: number) => Number(value.toFixed(places)) === value;

/**
 * Número decimal con límites y cantidad máxima de decimales.
 * Los formularios envían números (valueAsNumber); un campo vacío llega como NaN y se rechaza.
 */
export function decimal(
  label: string,
  opts: { min: number; max: number; places: number; minExclusive?: boolean },
) {
  const base = z
    .number({ error: `${label}: escribe un número` })
    .refine(Number.isFinite, `${label}: escribe un número`);
  return base
    .refine(
      (v) => (opts.minExclusive ? v > opts.min : v >= opts.min),
      opts.minExclusive
        ? `${label} debe ser mayor que ${opts.min}`
        : `${label} no puede ser menor que ${opts.min}`,
    )
    .refine(
      (v) => v <= opts.max,
      `${label} no puede ser mayor que ${opts.max.toLocaleString('en-US')}`,
    )
    .refine(
      (v) => hasMaxDecimals(v, opts.places),
      `${label} admite máximo ${opts.places} decimales`,
    );
}

export const priceSchema = (label = 'El precio') =>
  decimal(label, { min: 0, max: 99999.99, places: 2 });
/** Cantidad en la unidad base del artículo (u, ml, g). */
export const quantitySchema = (label = 'La cantidad') =>
  decimal(label, { min: 0, max: 999999.999, places: 3, minExclusive: true });
export const stockSchema = (label = 'El stock') =>
  decimal(label, { min: 0, max: 999999.999, places: 3 });
export const unitCostSchema = (label = 'El costo') =>
  decimal(label, { min: 0, max: 99999.9999, places: 4 });

export const intIdSchema = (label: string) =>
  z
    .number({ error: `Selecciona ${label}` })
    .int()
    .positive(`Selecciona ${label}`);

/** Parámetro de consulta booleano ("true"/"false"). */
export const queryBoolean = z
  .enum(['true', 'false'], { error: 'Usa true o false' })
  .transform((v) => v === 'true');

/** Fecha YYYY-MM-DD (día calendario del negocio). */
export const businessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'La fecha no es válida');
