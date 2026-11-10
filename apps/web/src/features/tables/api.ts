import type {
  DiningTableDto,
  TableBulkInput,
  TableInput,
  TableUpdateInput,
} from '@sanfefer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useTables = () =>
  useQuery({
    queryKey: ['tables'],
    queryFn: async () => (await api<{ tables: DiningTableDto[] }>('/tables')).tables,
  });

/** Un cambio en las mesas se refleja también en el mapa de mesas del POS. */
function useTablesMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['tables'] }),
        qc.invalidateQueries({ queryKey: ['pos', 'floor'] }),
      ]),
  });
}

export const useCreateTable = () =>
  useTablesMutation((input: TableInput) =>
    api<{ table: DiningTableDto }>('/tables', { method: 'POST', body: input }),
  );
export const useCreateTables = () =>
  useTablesMutation((input: TableBulkInput) =>
    api<{ created: string[]; skipped: string[] }>('/tables/bulk', { method: 'POST', body: input }),
  );
export const useUpdateTable = () =>
  useTablesMutation(({ id, input }: { id: number; input: TableUpdateInput }) =>
    api<{ table: DiningTableDto }>(`/tables/${id}`, { method: 'PATCH', body: input }),
  );
export const useDeleteTable = () =>
  useTablesMutation((id: number) => api<void>(`/tables/${id}`, { method: 'DELETE' }));
export const useReorderTables = () =>
  useTablesMutation((ids: number[]) =>
    api<{ tables: DiningTableDto[] }>('/tables/reorder', { method: 'POST', body: { ids } }),
  );
