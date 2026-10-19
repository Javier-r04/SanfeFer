/** Error de negocio con mensaje listo para mostrarse al usuario. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, 'BAD_REQUEST', message, fields);
export const unauthorized = (message = 'Tu sesión expiró. Vuelve a ingresar.') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'No tienes permiso para realizar esta acción.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'No se encontró el registro.') =>
  new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
