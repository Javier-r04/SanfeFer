import type {
  AuthUser,
  LoginTileUser,
  PasswordLoginInput,
  PinLoginInput,
  Role,
} from '@sanfefer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { sessionKey } from '@/lib/query-client';

export const homePath = (role: Role) => (role === 'ADMIN' ? '/admin' : '/pos');

/** Usuario en sesión; null si no hay sesión. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return (await api<{ user: AuthUser }>('/auth/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

export function useLoginUsers() {
  return useQuery({
    queryKey: ['auth', 'login-users'],
    queryFn: async () => (await api<{ users: LoginTileUser[] }>('/auth/login-users')).users,
  });
}

export function useLoginPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PinLoginInput) =>
      api<{ user: AuthUser }>('/auth/login/pin', { method: 'POST', body: input }),
    onSuccess: ({ user }) => qc.setQueryData(sessionKey, user),
  });
}

export function useLoginPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PasswordLoginInput) =>
      api<{ user: AuthUser }>('/auth/login/password', { method: 'POST', body: input }),
    onSuccess: ({ user }) => qc.setQueryData(sessionKey, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      // Primero la sesión (los guardas reaccionan y llevan al login); luego se descarta el resto del caché.
      qc.setQueryData(sessionKey, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    },
  });
}
