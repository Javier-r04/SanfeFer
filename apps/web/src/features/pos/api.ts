import type {
  BarDto,
  CancelItemInput,
  FloorDto,
  MenuCategory,
  OpenTabInput,
  OrderItemDto,
  SendOrderInput,
  SendOrderResult,
  TabDto,
  UpdateTabInput,
} from '@sanfefer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Las pantallas del POS se refrescan solas para ver lo que hacen otros dispositivos. */
const POLL_MS = 5000;

export const useMenu = () =>
  useQuery({
    queryKey: ['pos', 'menu'],
    queryFn: async () => (await api<{ categories: MenuCategory[] }>('/pos/menu')).categories,
    staleTime: 60_000,
  });

export const useFloor = () =>
  useQuery({
    queryKey: ['pos', 'floor'],
    queryFn: () => api<FloorDto>('/pos/floor'),
    refetchInterval: POLL_MS,
  });

export const useTab = (id: number) =>
  useQuery({
    queryKey: ['pos', 'tab', id],
    queryFn: async () => (await api<{ tab: TabDto }>(`/pos/tabs/${id}`)).tab,
    refetchInterval: POLL_MS,
  });

export const useBar = (enabled = true) =>
  useQuery({
    queryKey: ['pos', 'bar'],
    queryFn: () => api<BarDto>('/pos/bar'),
    refetchInterval: POLL_MS,
    enabled,
  });

/** Toda acción del POS refresca mesas, cuentas y barra (y el stock del admin). */
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['pos'] }),
      qc.invalidateQueries({ queryKey: ['inventory'] }),
    ]);
}

export function useOpenTab() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: OpenTabInput) =>
      api<{ tab: TabDto }>('/pos/tabs', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateTab() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTabInput }) =>
      api<{ tab: TabDto }>(`/pos/tabs/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useCancelTab() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/pos/tabs/${id}/cancel`, { method: 'POST', body: {} }),
    onSuccess: invalidate,
  });
}

export function useSendOrder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ tabId, input }: { tabId: number; input: SendOrderInput }) =>
      api<SendOrderResult>(`/pos/tabs/${tabId}/orders`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useSetItemStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'PENDING' | 'PREPARING' | 'DELIVERED' }) =>
      api<{ item: OrderItemDto }>(`/pos/items/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
  });
}

export function useCancelItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CancelItemInput }) =>
      api<{ tab: TabDto }>(`/pos/items/${id}/cancel`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useAdvanceOrder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, to }: { id: number; to: 'PREPARING' | 'DELIVERED' }) =>
      api<{ updated: number }>(`/pos/orders/${id}/advance`, { method: 'POST', body: { to } }),
    onSuccess: invalidate,
  });
}
