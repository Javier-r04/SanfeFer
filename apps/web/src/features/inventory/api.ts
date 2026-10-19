import type {
  InventoryItemCreateInput,
  InventoryItemDto,
  InventoryItemUpdateInput,
  InventorySummary,
  MovementDto,
  MovementInput,
  Page,
} from '@sanfefer/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ItemFilters {
  kind?: 'SUPPLY' | 'RESALE';
  alert?: boolean;
  includeInactive?: boolean;
  q?: string;
}

export interface MovementFilters {
  itemId?: number;
  type?: string;
  from?: string;
  to?: string;
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '' && v !== false) search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : '';
};

export function useInventoryItems(filters: ItemFilters = {}) {
  return useQuery({
    queryKey: ['inventory', 'items', filters],
    queryFn: async () =>
      (await api<{ items: InventoryItemDto[] }>(`/inventory/items${qs({ ...filters })}`)).items,
  });
}

export function useInventorySummary(enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: async () => (await api<{ summary: InventorySummary }>('/inventory/summary')).summary,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useMovements(filters: MovementFilters) {
  return useInfiniteQuery({
    queryKey: ['inventory', 'movements', filters],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<MovementDto>>(
        `/inventory/movements${qs({ ...filters, cursor: pageParam, limit: 50 })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Un cambio de inventario afecta costos y disponibilidad de los productos. */
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['inventory'] }),
      qc.invalidateQueries({ queryKey: ['catalog'] }),
    ]);
}

export function useCreateItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: InventoryItemCreateInput) =>
      api<{ item: InventoryItemDto }>('/inventory/items', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: InventoryItemUpdateInput }) =>
      api<{ item: InventoryItemDto }>(`/inventory/items/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/inventory/items/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCreateMovement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: number; input: MovementInput }) =>
      api<{ movement: MovementDto; item: InventoryItemDto }>(
        `/inventory/items/${itemId}/movements`,
        {
          method: 'POST',
          body: input,
        },
      ),
    onSuccess: invalidate,
  });
}
