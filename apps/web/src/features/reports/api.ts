import type {
  InventoryReportDto,
  ProductsReportDto,
  ReportGroupBy,
  SalesReportDto,
  SellersReportDto,
  TabReportRowDto,
} from '@sanfefer/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReportRange {
  from: string;
  to: string;
}

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString();

// Al cambiar el periodo se conserva el reporte anterior (atenuado) hasta que llega el nuevo.
function useReport<T>(name: string, params: Record<string, string>) {
  return useQuery({
    queryKey: ['reports', name, params],
    queryFn: async () => (await api<{ report: T }>(`/reports/${name}?${qs(params)}`)).report,
    placeholderData: keepPreviousData,
  });
}

export const useSalesReport = (r: ReportRange, groupBy: ReportGroupBy) =>
  useReport<SalesReportDto>('sales', { from: r.from, to: r.to, groupBy });

export const useProductsReport = (r: ReportRange) =>
  useReport<ProductsReportDto>('products', { from: r.from, to: r.to });

export const useSellersReport = (r: ReportRange) =>
  useReport<SellersReportDto>('sellers', { from: r.from, to: r.to });

export const useInventoryReport = (r: ReportRange) =>
  useReport<InventoryReportDto>('inventory', { from: r.from, to: r.to });

/** Detalle de cuentas cobradas; solo se pide al exportar. */
export const fetchTabsReport = async (r: ReportRange) =>
  (await api<{ tabs: TabReportRowDto[] }>(`/reports/tabs?${qs({ from: r.from, to: r.to })}`)).tabs;
