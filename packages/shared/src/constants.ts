export const BUSINESS_TIMEZONE = 'America/Guatemala';
export const CURRENCY = 'GTQ';

export const ROLES = ['ADMIN', 'SELLER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  SELLER: 'Vendedor',
};

export const PIN_REGEX = /^\d{4,6}$/;
export const USERNAME_REGEX = /^[a-z0-9._-]+$/;

/** Intentos fallidos antes de bloquear temporalmente el usuario. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 5;

// ───────────── Inventario ─────────────

export const UNITS = ['UNIT', 'ML', 'G'] as const;
export type MeasureUnit = (typeof UNITS)[number];

/** Abreviatura para mostrar junto a cantidades. */
export const UNIT_LABELS: Record<MeasureUnit, string> = { UNIT: 'u', ML: 'ml', G: 'g' };
export const UNIT_NAMES: Record<MeasureUnit, string> = {
  UNIT: 'Unidades',
  ML: 'Mililitros',
  G: 'Gramos',
};

export const INVENTORY_KINDS = ['SUPPLY', 'RESALE'] as const;
export type InventoryItemKind = (typeof INVENTORY_KINDS)[number];
export const KIND_LABELS: Record<InventoryItemKind, string> = {
  SUPPLY: 'Insumo',
  RESALE: 'Reventa',
};

export const MOVEMENT_TYPES = [
  'INITIAL',
  'PURCHASE',
  'PURCHASE_VOID',
  'SALE',
  'SALE_VOID',
  'WASTE',
  'MANUAL_IN',
  'ADJUSTMENT',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  INITIAL: 'Stock inicial',
  PURCHASE: 'Compra',
  PURCHASE_VOID: 'Compra anulada',
  SALE: 'Venta',
  SALE_VOID: 'Venta anulada',
  WASTE: 'Merma / salida',
  MANUAL_IN: 'Entrada manual',
  ADJUSTMENT: 'Ajuste por conteo',
};

/** Movimientos que el admin registra a mano desde Inventario. */
export const MANUAL_MOVEMENT_TYPES = ['MANUAL_IN', 'WASTE', 'ADJUSTMENT'] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

export type StockStatus = 'OK' | 'LOW' | 'OUT';
export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  OK: 'Suficiente',
  LOW: 'Stock bajo',
  OUT: 'Agotado',
};

export function stockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return 'OUT';
  if (stock <= minStock) return 'LOW';
  return 'OK';
}

// ───────────── Catálogo ─────────────

/** Colores de categoría: tokens de la paleta, se adaptan al tema claro/oscuro. */
export const CATEGORY_COLORS = ['primary', 'secondary', 'danger', 'warning', 'highlight'] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];
export const CATEGORY_COLOR_LABELS: Record<CategoryColor, string> = {
  primary: 'Quetzal',
  secondary: 'Cielo',
  danger: 'Achiote',
  warning: 'Maíz',
  highlight: 'Jacaranda',
};
