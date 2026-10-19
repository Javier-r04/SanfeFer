import type {
  PurchaseDto,
  PurchaseInput,
  PurchasesPage,
  SupplierDto,
  SupplierInput,
  SupplierUpdateInput,
} from '@sanfefer/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PurchaseFilters {
  supplierId?: number;
  status?: 'RECEIVED' | 'VOIDED';
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

export const useSuppliers = (includeInactive = false) =>
  useQuery({
    queryKey: ['purchases', 'suppliers', { includeInactive }],
    queryFn: async () =>
      (await api<{ suppliers: SupplierDto[] }>(`/purchases/suppliers${qs({ includeInactive })}`))
        .suppliers,
  });

export const usePurchases = (filters: PurchaseFilters) =>
  useInfiniteQuery({
    queryKey: ['purchases', 'list', filters],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      api<PurchasesPage>(`/purchases${qs({ ...filters, cursor: pageParam })}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const usePurchase = (id: number | null) =>
  useQuery({
    queryKey: ['purchases', 'detail', id],
    queryFn: async () => (await api<{ purchase: PurchaseDto }>(`/purchases/${id}`)).purchase,
    enabled: id !== null,
  });

/** Una compra cambia stock y costos: se refrescan inventario y catálogo. */
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ['purchases', 'inventory', 'catalog'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
    );
}

export function useCreateSupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: SupplierInput) =>
      api<{ supplier: SupplierDto }>('/purchases/suppliers', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateSupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SupplierUpdateInput }) =>
      api<{ supplier: SupplierDto }>(`/purchases/suppliers/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteSupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/purchases/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCreatePurchase() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: PurchaseInput) =>
      api<{ purchase: PurchaseDto }>('/purchases', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useVoidPurchase() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api<{ purchase: PurchaseDto }>(`/purchases/${id}/void`, { method: 'POST', body: { reason } }),
    onSuccess: invalidate,
  });
}
