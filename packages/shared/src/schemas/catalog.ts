import { z } from 'zod';
import { CATEGORY_COLORS } from '../constants';
import { intIdSchema, priceSchema, quantitySchema } from './numbers';

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} es obligatorio` })
    .trim()
    .min(
      min,
      min === 1 ? `${label} es obligatorio` : `${label} debe tener al menos ${min} caracteres`,
    )
    .max(max, `${label} no puede tener más de ${max} caracteres`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede tener más de ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

export const reorderSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, 'No hay elementos para ordenar')
    .refine((ids) => new Set(ids).size === ids.length, 'Hay elementos repetidos'),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

// ───────────── Categorías ─────────────

export const categoryInputSchema = z.object({
  name: text('El nombre', 2, 40),
  color: z.enum(CATEGORY_COLORS, { error: 'Elige un color' }),
  active: z.boolean().optional(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryUpdateSchema = categoryInputSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

// ───────────── Recetas (producto o extra → inventario) ─────────────

export const recipeLineSchema = z.object({
  inventoryItemId: intIdSchema('un artículo de inventario'),
  quantity: quantitySchema(),
});
export type RecipeLineInput = z.infer<typeof recipeLineSchema>;

export const recipeSchema = z
  .array(recipeLineSchema)
  .max(20, 'Máximo 20 insumos por receta')
  .superRefine((lines, ctx) => {
    const seen = new Set<number>();
    lines.forEach((l, i) => {
      if (seen.has(l.inventoryItemId)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'inventoryItemId'],
          message: 'Este artículo ya está en la receta; suma las cantidades en una sola línea',
        });
      }
      seen.add(l.inventoryItemId);
    });
  });

// ───────────── Productos ─────────────

const productFields = {
  name: text('El nombre', 2, 60),
  categoryId: intIdSchema('una categoría'),
  price: priceSchema(),
  description: optionalText('La descripción', 200),
  active: z.boolean(),
  recipe: recipeSchema,
  modifierGroupIds: z
    .array(z.number().int().positive())
    .max(10, 'Máximo 10 grupos de extras')
    .refine((ids) => new Set(ids).size === ids.length, 'Un grupo de extras está repetido'),
};

export const productInputSchema = z.object({
  ...productFields,
  active: productFields.active.default(true),
  recipe: productFields.recipe.default([]),
  modifierGroupIds: productFields.modifierGroupIds.default([]),
});
export type ProductInput = z.input<typeof productInputSchema>;

export const productUpdateSchema = z
  .object(productFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;

// ───────────── Grupos de extras ─────────────

export const modifierOptionInputSchema = z.object({
  /** Presente al editar una opción existente. */
  id: z.number().int().positive().optional(),
  name: text('El nombre de la opción', 1, 40),
  priceDelta: priceSchema('El recargo'),
  active: z.boolean().default(true),
  components: recipeSchema.default([]),
});

export const modifierGroupInputSchema = z
  .object({
    name: text('El nombre del grupo', 2, 40),
    minSelect: z
      .number({ error: 'Escribe un número' })
      .int('Debe ser un número entero')
      .min(0, 'No puede ser negativo')
      .max(10),
    maxSelect: z
      .number({ error: 'Escribe un número' })
      .int('Debe ser un número entero')
      .min(1, 'Debe ser al menos 1')
      .max(10),
    active: z.boolean().default(true),
    options: z
      .array(modifierOptionInputSchema)
      .min(1, 'Agrega al menos una opción')
      .max(20, 'Máximo 20 opciones'),
  })
  .superRefine((g, ctx) => {
    if (g.minSelect > g.maxSelect) {
      ctx.addIssue({
        code: 'custom',
        path: ['minSelect'],
        message: 'El mínimo no puede ser mayor que el máximo',
      });
    }
    const activeOptions = g.options.filter((o) => o.active !== false).length;
    if (g.minSelect > activeOptions) {
      ctx.addIssue({
        code: 'custom',
        path: ['minSelect'],
        message: `Hay ${activeOptions} opciones activas; no se pueden exigir ${g.minSelect}`,
      });
    }
    const names = new Set<string>();
    g.options.forEach((o, i) => {
      const key = o.name.trim().toLowerCase();
      if (names.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['options', i, 'name'],
          message: 'Ya hay una opción con ese nombre',
        });
      }
      names.add(key);
    });
  });
export type ModifierGroupInput = z.input<typeof modifierGroupInputSchema>;
