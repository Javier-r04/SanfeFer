# SanfeFer

Sistema web de punto de venta para un negocio de bebidas (micheladas, cervezas…): POS por mesas y clientes, barra, inventario con recetas, compras, caja y reportes. Interfaz en español; funciona en PC, tablet y celular, con tema claro y oscuro.

- Plan, modelo de datos y fases: [`docs/PLAN.md`](docs/PLAN.md)
- **Publicar en internet** (Supabase + Render + Vercel), paso a paso: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Esquema de base de datos: [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma)

## Estado

| Fase | Contenido                                                | Estado |
| ---- | -------------------------------------------------------- | ------ |
| 0    | Fundaciones, ingreso con PIN/contraseña, roles, usuarios | ✅     |
| 1    | Catálogo e inventario                                    | ✅     |
| 2    | Compras                                                  | ✅     |
| 3    | POS: mesas, órdenes y barra                              | ✅     |
| 4    | Cobro, ticket y caja                                     | ✅     |
| 5    | Reportes y CSV                                           | ✅     |
| 6    | PWA y despliegue (Vercel + Render + Supabase)            | ✅     |

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
npm run db:seed                    # carga usuarios, mesas, inventario, menú y 8 semanas de ventas

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

El seed también genera un **historial de 8 semanas** (hasta ayer): unas 740 cuentas cobradas, cajas cerradas con su arqueo, compras semanales, mermas y algunas cancelaciones. Hoy queda libre para tus pruebas. Siempre salen los mismos números, y el inventario cuadra: cada venta deja su movimiento, y el stock final es el de la lista del seed, con las alertas de stock bajo y agotado.

## Scripts

| Comando              | Qué hace                                              |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | API + web con recarga automática                      |
| `npm test`           | Pruebas (las de la API usan la base `sanfefer_test`)  |
| `npm run typecheck`  | Revisión de tipos en todos los paquetes               |
| `npm run lint`       | ESLint                                                |
| `npm run build`      | Compila API (`apps/api/dist`) y web (`apps/web/dist`) |
| `npm run format`     | Formatea con Prettier (la CI revisa el formato)       |
| `npm run db:migrate` | Crea/aplica migraciones en desarrollo                 |
| `npm run db:seed`    | Recarga los datos de prueba                           |
| `npm run db:reset`   | Borra la base, aplica migraciones y corre el seed     |
| `npm run db:studio`  | Explorador visual de la base (Prisma Studio)          |

## Estructura

```
apps/api        Express + Prisma (módulos en src/modules/*: routes · controller · service)
apps/web        React + Vite + Tailwind (pantallas en src/features/*)
packages/shared Validaciones Zod, tipos y utilidades compartidas por API y web
docs/           Plan técnico y guía de despliegue
render.yaml     API en Render (Blueprint)
vercel.json     Web en Vercel; reenvía /api a Render
.github/        CI (formato, tipos, lint, pruebas, build) y ping opcional a la API
```

## Decisiones técnicas

- **Validación compartida**: los mismos esquemas Zod validan los formularios y las peticiones a la API; los mensajes están en español.
- **Sesión** en cookie `httpOnly` firmada (JWT). Cambiar el PIN, la contraseña o el rol, o desactivar a un usuario, cierra sus sesiones al instante.
- **Bloqueo** tras 5 intentos fallidos durante 5 minutos (el admin puede desbloquear), más un límite de intentos por dispositivo.
- **Jornada**: día calendario en hora de Guatemala (`America/Guatemala`); lo vendido después de medianoche cuenta para el día siguiente.
- **Dinero** en `Decimal`, nunca en `float`.
- **Inventario**: todo cambio de stock pasa por un solo punto (`apps/api/src/modules/inventory/stock.ts`), dentro de una transacción, con bloqueo de fila y su movimiento en el historial. Las entradas con costo recalculan el **costo promedio ponderado**.
- **Compras**: se registran como en la factura (cantidad y total de la línea); el costo por unidad se deriva. La compra y el aumento de stock van en una sola transacción. Anular devuelve stock y costo promedio, y se rechaza si lo comprado ya se usó.
- **POS**: el inventario se descuenta al **enviar a barra** (receta + extras). Cancelar un producto pendiente devuelve el inventario; si ya se estaba preparando o se entregó, requiere el PIN de un administrador y se registra como merma. La orden en curso se guarda en el dispositivo hasta enviarla. Mesas, cuentas y barra se refrescan cada 5 s.
- **Costo y margen del producto**: receta + la opción más barata de cada grupo de extras obligatorio (p. ej. la cerveza de la michelada). La disponibilidad considera también esos extras (Gallo **o** Corona).
- **Cobro**: total = subtotal − descuento + servicio (el servicio se calcula sobre el subtotal ya con descuento). Los cálculos de dinero se hacen en centavos enteros. Se aceptan pagos parciales y mixtos (efectivo con vuelto y tarjeta con referencia); la cuenta se cierra sola al quedar pagada y sus totales se congelan. Cobrar requiere una caja abierta.
- **Descuentos**: el vendedor necesita el PIN de un administrador; el motivo queda con quién autorizó. Ni un descuento ni una cancelación pueden dejar el total por debajo de lo ya pagado.
- **Dividir cuenta**: los productos (o parte de una línea) se mueven a otra cuenta de la mesa o a una nueva "Cliente N"; también se puede cobrar en partes iguales (÷N).
- **Ticket**: comprobante interno, **no es factura**. Un mismo documento se dibuja como vista previa/impresión del navegador (58 u 80 mm) y como comandos **ESC/POS** para impresoras térmicas (USB/serie vía Web Serial en Chrome/Edge, o descarga `.bin`).
- **Caja**: solo una caja abierta a la vez (índice único parcial en la base de datos). Debe haber = fondo + ventas en efectivo + entradas − salidas; al cerrar se registra lo contado y la diferencia. El cierre del día cuenta los cobros por **fecha de cobro** en la jornada de Guatemala.
- **Reportes** (solo admin): usan el mismo criterio que el cierre del día. Cuentan las cuentas cobradas por **fecha de cobro** (jornada de Guatemala), sin los productos cancelados.
  - **Ventas netas** = subtotal − descuentos.
  - **Utilidad bruta** = ventas netas − costo de lo vendido. El costo es el de la receta y los extras al costo promedio del momento en que se envió a barra.
  - El cargo por servicio se muestra aparte y no cuenta como utilidad. Las mermas se restan al final.
  - Cada periodo se compara con el anterior del mismo largo. Las semanas empiezan en lunes. El rango máximo es de dos años.
- **CSV**: se genera en el navegador. Usa coma como separador, punto decimal, UTF-8 con BOM (Excel muestra bien los acentos) y fechas `AAAA-MM-DD`. Los textos que empiezan con `=`, `+`, `-` o `@` se neutralizan para que Excel no los ejecute como fórmulas.
- **PWA**: se instala en Android, iPhone y PC (manifiesto, íconos y _service worker_ con `vite-plugin-pwa`).
  - El service worker solo guarda la app (HTML, JS, CSS, fuentes); los datos siempre vienen de la API, que responde con `Cache-Control: no-store`.
  - Sin conexión la app abre y avisa; la orden en curso queda en el dispositivo.
  - Las versiones nuevas se anuncian con un botón "Actualizar": nunca se recarga sola a mitad de un cobro. Las tablets revisan si hay versión nueva cada hora.
  - Las pantallas de administración se cargan al entrar a ellas, para que el POS abra rápido en el celular.
- **Despliegue**: Vercel reenvía `/api` a Render, así que web y API son un solo sitio. La cookie de sesión es propia (funciona en Safari) y no hace falta CORS.
  - Con dos proxies delante, `TRUST_PROXY=2` permite que el límite de intentos vea la IP real de cada cliente.
  - La API aplica las migraciones al arrancar.
  - En el primer arranque crea el administrador con las variables `ADMIN_*` (no se usa el seed en producción).
