import type { CreateUserInput, UpdateUserInput, UserDto } from '@sanfefer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const usersKey = ['users'] as const;

export function useUsers() {
  return useQuery({
    queryKey: usersKey,
    queryFn: async () => (await api<{ users: UserDto[] }>('/users')).users,
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: usersKey });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      api<{ user: UserDto }>('/users', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) =>
      api<{ user: UserDto }>(`/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useUnlockUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: number) => api<{ user: UserDto }>(`/users/${id}/unlock`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
