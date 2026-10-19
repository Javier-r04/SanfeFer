import type {
  CategoryColor,
  InventoryItemKind,
  MeasureUnit,
  MovementType,
  Role,
  StockStatus,
} from './constants';

/** Usuario autenticado tal como lo devuelve /auth/me. */
export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
}

/** Usuario visible en la pantalla de ingreso con PIN. */
export interface LoginTileUser {
  id: number;
  name: string;
  username: string;
  initials: string;
}

export interface UserDto extends AuthUser {
  active: boolean;
  hasPin: boolean;
  hasPassword: boolean;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Forma de todas las respuestas de error de la API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Errores por campo, en el mismo formato que usa el formulario. */
    fields?: Record<string, string>;
  };
}

// ───────────── Catálogo e inventario ─────────────

export interface CategoryDto {
  id: number;
  name: string;
  color: CategoryColor;
  sortOrder: number;
  active: boolean;
  productCount: number;
}

/** Línea de receta con el costo y stock actuales del artículo. */
export interface RecipeLineDto {
  inventoryItemId: number;
  name: string;
  unit: MeasureUnit;
  quantity: number;
  unitCost: number;
  lineCost: number;
  stock: number;
  itemActive: boolean;
}

export interface ProductDto {
  id: number;
  name: string;
  description: string | null;
  price: number;
  categoryId: number;
  categoryName: string;
  active: boolean;
  sortOrder: number;
  recipe: RecipeLineDto[];
  modifierGroupIds: number[];
  /** Costo solo de la receta, con el costo promedio actual. */
  recipeCost: number;
  /** Precio más los recargos mínimos de los extras obligatorios (lo mínimo que paga el cliente). */
  basePrice: number;
  /** Costo de la receta más los extras obligatorios más baratos (ej. la cerveza de la michelada). */
  cost: number;
  /** (precio base − costo) / precio base; null si el precio es 0. */
  margin: number | null;
  /** Porciones que alcanzan con el stock (receta y extras obligatorios); null si no controla stock. */
  available: number | null;
  stockStatus: StockStatus | null;
}

export interface ModifierOptionDto {
  id: number;
  name: string;
  priceDelta: number;
  active: boolean;
  sortOrder: number;
  components: RecipeLineDto[];
  cost: number;
}

export interface ModifierGroupDto {
  id: number;
  name: string;
  minSelect: number;
  maxSelect: number;
  active: boolean;
  sortOrder: number;
  productCount: number;
  options: ModifierOptionDto[];
}

export interface InventoryItemDto {
  id: number;
  name: string;
  kind: InventoryItemKind;
  unit: MeasureUnit;
  stock: number;
  minStock: number;
  averageCost: number;
  stockValue: number;
  status: StockStatus;
  active: boolean;
  /** Productos y extras cuya receta lo usa. */
  usedIn: number;
  updatedAt: string;
}

export interface InventorySummary {
  totalItems: number;
  lowCount: number;
  outCount: number;
  stockValue: number;
}

export interface MovementDto {
  id: number;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  stockAfter: number;
  reason: string | null;
  createdAt: string;
  item: { id: number; name: string; unit: MeasureUnit };
  user: { id: number; name: string };
}

export interface Page<T> {
  items: T[];
  nextCursor: number | null;
}
