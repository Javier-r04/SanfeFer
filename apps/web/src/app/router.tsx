import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { AdminLoginPage } from '@/features/auth/AdminLoginPage';
import { PosCashPage } from '@/features/cash/PosCashPage';
import { GuestOnly, RequireAuth, RootRedirect } from '@/features/auth/guards';
import { PinLoginPage } from '@/features/auth/PinLoginPage';
import { NotFoundPage } from '@/features/common/NotFoundPage';
import { RouteError } from '@/features/common/RouteError';
import { BarPage } from '@/features/pos/BarPage';
import { FloorPage } from '@/features/pos/FloorPage';
import { OrderPage } from '@/features/pos/OrderPage';
import { PaymentPage } from '@/features/pos/PaymentPage';
import { TabPage } from '@/features/pos/TabPage';
import { AdminLayout } from './layouts/AdminLayout';
import { PosLayout } from './layouts/PosLayout';

/**
 * Las pantallas de administración se cargan al entrar a ellas: el POS (lo que usan los
 * vendedores en el celular) abre más rápido sin cargar reportes, catálogo ni inventario.
 */
const page =
  <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] });

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <RootRedirect /> },
      {
        path: '/login',
        element: (
          <GuestOnly>
            <PinLoginPage />
          </GuestOnly>
        ),
      },
      {
        path: '/login/admin',
        element: (
          <GuestOnly>
            <AdminLoginPage />
          </GuestOnly>
        ),
      },
      {
        path: '/pos',
        element: (
          <RequireAuth>
            <PosLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <FloorPage /> },
          { path: 'barra', element: <BarPage /> },
          { path: 'cuentas/:tabId', element: <TabPage />, handle: { hideNav: true } },
          { path: 'cuentas/:tabId/orden', element: <OrderPage />, handle: { hideNav: true } },
          { path: 'cuentas/:tabId/cobro', element: <PaymentPage />, handle: { hideNav: true } },
          { path: 'caja', element: <PosCashPage /> },
        ],
      },
      {
        path: '/admin',
        element: (
          <RequireAuth roles={['ADMIN']}>
            <AdminLayout />
          </RequireAuth>
        ),
        children: [
          {
            index: true,
            lazy: page(() => import('@/features/admin/AdminHomePage'), 'AdminHomePage'),
          },
          { path: 'usuarios', lazy: page(() => import('@/features/users/UsersPage'), 'UsersPage') },
          {
            path: 'productos',
            lazy: page(() => import('@/features/catalog/CatalogPage'), 'CatalogPage'),
          },
          {
            path: 'inventario',
            lazy: page(() => import('@/features/inventory/InventoryPage'), 'InventoryPage'),
          },
          {
            path: 'compras',
            lazy: page(() => import('@/features/purchases/PurchasesPage'), 'PurchasesPage'),
          },
          {
            path: 'compras/nueva',
            lazy: page(() => import('@/features/purchases/NewPurchasePage'), 'NewPurchasePage'),
          },
          {
            path: 'caja',
            lazy: page(() => import('@/features/cash/AdminCashPage'), 'AdminCashPage'),
          },
          {
            path: 'reportes',
            lazy: page(() => import('@/features/reports/ReportsPage'), 'ReportsPage'),
          },
          {
            path: 'ajustes',
            lazy: page(() => import('@/features/settings/SettingsPage'), 'SettingsPage'),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
