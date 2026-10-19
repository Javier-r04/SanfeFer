import type {
  CategoryDto,
  CategoryInput,
  CategoryUpdateInput,
  ModifierGroupDto,
  ModifierGroupInput,
  ProductDto,
  ProductInput,
  ProductUpdateInput,
} from '@sanfefer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useCategories = () =>
  useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: async () =>
      (await api<{ categories: CategoryDto[] }>('/catalog/categories')).categories,
  });

export const useProducts = () =>
  useQuery({
    queryKey: ['catalog', 'products'],
    queryFn: async () => (await api<{ products: ProductDto[] }>('/catalog/products')).products,
  });

export const useModifierGroups = () =>
  useQuery({
    queryKey: ['catalog', 'modifier-groups'],
    queryFn: async () =>
      (await api<{ groups: ModifierGroupDto[] }>('/catalog/modifier-groups')).groups,
  });

/** El catálogo y el inventario se relacionan (recetas, "usado en"): se refrescan juntos. */
function useCatalogMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['catalog'] }),
        qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
      ]),
  });
}

export const useCreateCategory = () =>
  useCatalogMutation((input: CategoryInput) =>
    api<{ category: CategoryDto }>('/catalog/categories', { method: 'POST', body: input }),
  );
export const useUpdateCategory = () =>
  useCatalogMutation(({ id, input }: { id: number; input: CategoryUpdateInput }) =>
    api<{ category: CategoryDto }>(`/catalog/categories/${id}`, { method: 'PATCH', body: input }),
  );
export const useDeleteCategory = () =>
  useCatalogMutation((id: number) => api<void>(`/catalog/categories/${id}`, { method: 'DELETE' }));
export const useReorderCategories = () =>
  useCatalogMutation((ids: number[]) =>
    api<{ categories: CategoryDto[] }>('/catalog/categories/reorder', {
      method: 'POST',
      body: { ids },
    }),
  );

export const useCreateProduct = () =>
  useCatalogMutation((input: ProductInput) =>
    api<{ product: ProductDto }>('/catalog/products', { method: 'POST', body: input }),
  );
export const useUpdateProduct = () =>
  useCatalogMutation(({ id, input }: { id: number; input: ProductUpdateInput }) =>
    api<{ product: ProductDto }>(`/catalog/products/${id}`, { method: 'PATCH', body: input }),
  );
export const useDeleteProduct = () =>
  useCatalogMutation((id: number) => api<void>(`/catalog/products/${id}`, { method: 'DELETE' }));
export const useReorderProducts = () =>
  useCatalogMutation((ids: number[]) =>
    api<void>('/catalog/products/reorder', { method: 'POST', body: { ids } }),
  );

export const useSaveModifierGroup = () =>
  useCatalogMutation(({ id, input }: { id?: number; input: ModifierGroupInput }) =>
    api<{ group: ModifierGroupDto }>(
      id ? `/catalog/modifier-groups/${id}` : '/catalog/modifier-groups',
      {
        method: id ? 'PUT' : 'POST',
        body: input,
      },
    ),
  );
export const useSetModifierGroupActive = () =>
  useCatalogMutation(({ id, active }: { id: number; active: boolean }) =>
    api<{ group: ModifierGroupDto }>(`/catalog/modifier-groups/${id}`, {
      method: 'PATCH',
      body: { active },
    }),
  );
export const useDeleteModifierGroup = () =>
  useCatalogMutation((id: number) =>
    api<void>(`/catalog/modifier-groups/${id}`, { method: 'DELETE' }),
  );
