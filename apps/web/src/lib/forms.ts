import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from '@/stores/toast';
import { ApiError, errorMessage } from './api';

/**
 * Muestra el error de la API: los errores por campo (p. ej. "recipe.0.inventoryItemId")
 * se colocan junto al campo del formulario y el mensaje general va en un aviso.
 */
export function handleFormError<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (err instanceof ApiError && err.fields) {
    for (const [field, message] of Object.entries(err.fields)) {
      if (field !== '_') setError(field as Path<T>, { message });
    }
  }
  toast.error(errorMessage(err));
}

/** Para inputs numéricos opcionales: vacío → undefined en vez de NaN. */
export const optionalNumber = (v: unknown) => (v === '' || v === null ? undefined : Number(v));
