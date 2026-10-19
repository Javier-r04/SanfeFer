import { createBrowserRouter } from 'react-router';
import { AdminHomePage } from '@/features/admin/AdminHomePage';
import { AdminLoginPage } from '@/features/auth/AdminLoginPage';
import { AdminCashPage } from '@/features/cash/AdminCashPage';
import { PosCashPage } from '@/features/cash/PosCashPage';
import { CatalogPage } from '@/features/catalog/CatalogPage';
import { GuestOnly, RequireAuth, RootRedirect } from '@/features/auth/guards';
import { PinLoginPage } from '@/features/auth/PinLoginPage';
import { NotFoundPage } from '@/features/common/NotFoundPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { NewPurchasePage } from '@/features/purchases/NewPurchasePage';
import { PurchasesPage } from '@/features/purchases/PurchasesPage';
import { BarPage } from '@/features/pos/BarPage';
import { FloorPage } from '@/features/pos/FloorPage';
import { OrderPage } from '@/features/pos/OrderPage';
import { PaymentPage } from '@/features/pos/PaymentPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { TabPage } from '@/features/pos/TabPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { AdminLayout } from './layouts/AdminLayout';
import { PosLayout } from './layouts/PosLayout';

export const router = createBrowserRouter([
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
      { index: true, element: <AdminHomePage /> },
      { path: 'usuarios', element: <UsersPage /> },
      { path: 'productos', element: <CatalogPage /> },
      { path: 'inventario', element: <InventoryPage /> },
      { path: 'compras', element: <PurchasesPage /> },
      { path: 'compras/nueva', element: <NewPurchasePage /> },
      { path: 'caja', element: <AdminCashPage /> },
      { path: 'reportes', element: <ReportsPage /> },
      { path: 'ajustes', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
