import { createBrowserRouter } from 'react-router';
import { AdminHomePage } from '@/features/admin/AdminHomePage';
import { AdminLoginPage } from '@/features/auth/AdminLoginPage';
import { GuestOnly, RequireAuth, RootRedirect } from '@/features/auth/guards';
import { PinLoginPage } from '@/features/auth/PinLoginPage';
import { ComingSoon } from '@/features/common/ComingSoon';
import { NotFoundPage } from '@/features/common/NotFoundPage';
import { PosPlaceholderPage } from '@/features/pos/PosPlaceholderPage';
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
      {
        index: true,
        element: (
          <PosPlaceholderPage
            title="Mesas"
            phase={3}
            description="Aquí verás las mesas, los clientes sin mesa y podrás tomar órdenes."
          />
        ),
      },
      {
        path: 'barra',
        element: (
          <PosPlaceholderPage
            title="Barra"
            phase={3}
            description="Comandas pendientes, en preparación y entregadas."
          />
        ),
      },
      {
        path: 'caja',
        element: (
          <PosPlaceholderPage
            title="Caja"
            phase={4}
            description="Apertura, arqueo y cierre de caja."
          />
        ),
      },
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
      {
        path: 'productos',
        element: (
          <ComingSoon
            title="Productos y menú"
            phase={1}
            description="Categorías, productos, extras y recetas que descuentan inventario."
          />
        ),
      },
      {
        path: 'inventario',
        element: (
          <ComingSoon
            title="Inventario"
            phase={1}
            description="Insumos, stock mínimo con alertas y el historial de movimientos."
          />
        ),
      },
      {
        path: 'compras',
        element: (
          <ComingSoon
            title="Compras"
            phase={2}
            description="Proveedores y compras que aumentan el inventario."
          />
        ),
      },
      {
        path: 'caja',
        element: (
          <ComingSoon
            title="Caja"
            phase={4}
            description="Historial de cierres y diferencias de caja."
          />
        ),
      },
      {
        path: 'reportes',
        element: (
          <ComingSoon
            title="Reportes"
            phase={5}
            description="Ventas por periodo, productos, vendedores, utilidad y exportación a CSV."
          />
        ),
      },
      {
        path: 'ajustes',
        element: (
          <ComingSoon
            title="Ajustes"
            phase={4}
            description="Datos del negocio, cargo por servicio e impresora de tickets."
          />
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
