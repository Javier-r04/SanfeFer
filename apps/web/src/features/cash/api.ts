import type {
  CashMovementInput,
  CashSessionDto,
  CloseCashInput,
  DailyCloseDto,
  OpenCashInput,
  Page,
} from '@sanfefer/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useCurrentCash = () =>
  useQuery({
    queryKey: ['cash', 'current'],
    queryFn: async () => (await api<{ session: CashSessionDto | null }>('/cash/current')).session,
    refetchInterval: 15_000,
  });

export const useDaily = (date?: string) =>
  useQuery({
    queryKey: ['cash', 'daily', date ?? 'today'],
    queryFn: async () =>
      (await api<{ daily: DailyCloseDto }>(`/cash/daily${date ? `?date=${date}` : ''}`)).daily,
  });

export const useCashSessions = () =>
  useInfiniteQuery({
    queryKey: ['cash', 'sessions'],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<CashSessionDto>>(`/cash/sessions${pageParam ? `?cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

function useCashMutation<T>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: T) =>
      api<{ session: CashSessionDto }>(path, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash'] }),
  });
}

export const useOpenCash = () => useCashMutation<OpenCashInput>('/cash/open');
export const useCashMovement = () => useCashMutation<CashMovementInput>('/cash/movements');
export const useCloseCash = () => useCashMutation<CloseCashInput>('/cash/close');
