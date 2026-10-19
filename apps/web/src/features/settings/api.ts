import type { SettingsDto, SettingsInput } from '@sanfefer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useSettings = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api<{ settings: SettingsDto }>('/settings')).settings,
    staleTime: 5 * 60_000,
  });

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) =>
      api<{ settings: SettingsDto }>('/settings', { method: 'PATCH', body: input }),
    onSuccess: ({ settings }) => qc.setQueryData(['settings'], settings),
  });
}
