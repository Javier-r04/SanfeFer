# SanfeFer

Sistema web de punto de venta para un negocio de bebidas (micheladas, cervezas…): POS por mesas y clientes, barra, inventario con recetas, compras, caja y reportes. Interfaz en español; funciona en PC, tablet y celular, con tema claro y oscuro.

- Plan, modelo de datos y fases: [`docs/PLAN.md`](docs/PLAN.md)
- Esquema de base de datos: [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma)

## Estado

| Fase | Contenido                                                | Estado |
| ---- | -------------------------------------------------------- | ------ |
| 0    | Fundaciones, ingreso con PIN/contraseña, roles, usuarios | ✅     |
| 1    | Catálogo e inventario                                    | ⏳     |
| 2    | Compras                                                  | ⏳     |
| 3    | POS: mesas, órdenes y barra                              | ⏳     |
| 4    | Cobro, ticket y caja                                     | ⏳     |
| 5    | Reportes y CSV                                           | ⏳     |
| 6    | PWA y despliegue (Vercel + Render + Supabase)            | ⏳     |

## Requisitos

- Node.js 20.19 o superior (recomendado 22, ver `.nvmrc`)
- PostgreSQL 16: con Docker (`docker compose`) o instalado en tu equipo

## Puesta en marcha (local)

```bash
# 1. Dependencias
npm install

# 2. Base de datos
npm run db:up                      # Postgres en Docker (usuario/clave: sanfefer/sanfefer)
cp apps/api/.env.example apps/api/.env

# 3. Tablas y datos de prueba
npm run db:migrate                 # aplica las migraciones
npm run db:seed                    # carga usuarios, mesas, inventario y menú de prueba

# 4. Levantar API (puerto 4000) y web (puerto 5173)
npm run dev
```

Abre http://localhost:5173. Para probar desde el celular en la misma red Wi-Fi, usa la dirección "Network" que muestra Vite (por ejemplo `http://192.168.1.20:5173`).

> **Sin Docker:** crea en tu Postgres el usuario `sanfefer` (clave `sanfefer`, con permiso `CREATEDB`) y las bases `sanfefer` y `sanfefer_test`, o ajusta `DATABASE_URL` y `DIRECT_URL` en `apps/api/.env`.

### Usuarios de prueba

| Usuario            | Rol           | Ingreso                                |
| ------------------ | ------------- | -------------------------------------- |
| `admin` (Fernanda) | Administrador | contraseña `Sanfefer2026` · PIN `9999` |
| `luis`             | Vendedor      | PIN `1234`                             |
| `ana`              | Vendedor      | PIN `2345`                             |
| `marta`            | Vendedor      | PIN `3456`                             |
| `carlos`           | Vendedor      | PIN `4567`                             |

`npm run db:seed` borra todo y vuelve a cargar estos datos. Cámbialos antes de usar el sistema de verdad.

## Scripts

| Comando              | Qué hace                                              |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | API + web con recarga automática                      |
| `npm test`           | Pruebas (las de la API usan la base `sanfefer_test`)  |
| `npm run typecheck`  | Revisión de tipos en todos los paquetes               |
| `npm run lint`       | ESLint                                                |
| `npm run build`      | Compila API (`apps/api/dist`) y web (`apps/web/dist`) |
| `npm run db:migrate` | Crea/aplica migraciones en desarrollo                 |
| `npm run db:seed`    | Recarga los datos de prueba                           |
| `npm run db:reset`   | Borra la base, aplica migraciones y corre el seed     |
| `npm run db:studio`  | Explorador visual de la base (Prisma Studio)          |

## Estructura

```
apps/api        Express + Prisma (módulos en src/modules/*: routes · controller · service)
apps/web        React + Vite + Tailwind (pantallas en src/features/*)
packages/shared Validaciones Zod, tipos y utilidades compartidas por API y web
docs/           Plan técnico
```

## Decisiones técnicas

- **Validación compartida**: los mismos esquemas Zod validan los formularios y las peticiones a la API; los mensajes están en español.
- **Sesión** en cookie `httpOnly` firmada (JWT). Cambiar el PIN, la contraseña o el rol, o desactivar a un usuario, cierra sus sesiones al instante.
- **Bloqueo** tras 5 intentos fallidos durante 5 minutos (el admin puede desbloquear), más un límite de intentos por dispositivo.
- **Jornada**: día calendario en hora de Guatemala (`America/Guatemala`); lo vendido después de medianoche cuenta para el día siguiente.
- **Dinero** en `Decimal`, nunca en `float`.
