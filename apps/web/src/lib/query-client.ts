import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const sessionKey = ['auth', 'me'] as const;

function onUnauthorized(err: unknown) {
  // Sesión vencida o revocada en cualquier petición: los guardas de ruta llevan al login.
  if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(sessionKey, null);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onUnauthorized }),
  mutationCache: new MutationCache({ onError: onUnauthorized }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Reintenta solo fallas de red o del servidor, no errores de validación o permisos.
      retry: (count, err) =>
        err instanceof ApiError && (err.status === 0 || err.status >= 500) && count < 2,
    },
    mutations: { retry: false },
  },
});
