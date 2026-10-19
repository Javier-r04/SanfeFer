import type { Role } from './constants';

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
