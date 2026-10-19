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
