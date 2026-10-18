# SanfeFer — Propuesta técnica (pendiente de aprobación)

Modelo de datos completo: [`schema.propuesta.prisma`](./schema.propuesta.prisma) (validado con `prisma validate`).

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Monorepo | npm workspaces (`apps/web`, `apps/api`, `packages/shared`) | Un solo repo; Vercel y Render lo soportan sin configuración extra |
| Validación | **Zod** en `packages/shared` | El mismo esquema valida en el frontend (formularios) y en el backend (requests) |
| Frontend | React + Vite + TS + Tailwind, React Router, TanStack Query, Zustand, React Hook Form | Query maneja caché y reintentos (útil con la red del celular); Zustand guarda la orden en curso aunque se recargue la página |
| Backend | Express + TS, Prisma, bcrypt, JWT en cookie httpOnly | — |
| BD | PostgreSQL 16 en Docker (local) → Supabase (producción) | — |
| Tests | Vitest + Supertest | Cubrir lo crítico: totales, descuentos, vuelto, descuento de inventario |

Decisiones relevantes:
- **Dinero en `Decimal`** (nunca `float`) y cálculos con `decimal.js`, para evitar errores de redondeo en totales y costos.
- **Cookies sin problemas entre dominios**: Vercel reenvía `/api/*` a Render (rewrite), así el navegador ve un solo dominio y la cookie de sesión funciona también en Safari/iPhone.
- **Estado de barra por polling cada 5 s** (TanStack Query). Es más robusto que WebSockets con el plan gratuito de Render; se puede cambiar a SSE después.
- **Instalable como PWA** para que los vendedores la abran en el celular como si fuera una app.
- **Render gratuito se duerme** tras 15 min sin uso (la primera petición tarda ~30-60 s). Mitigación: un ping programado durante el horario de apertura.

## Modelo de datos — conceptos clave

- **Tab (cuenta)**: cada cliente tiene su propia cuenta. Una mesa ocupada = una o más cuentas abiertas con ese `tableId`. `tableId = null` → cliente independiente, identificado por nombre.
- **Order (comanda)**: cada "Enviar a barra" crea una comanda con sus ítems. **OrderItem** guarda `tabId` (cuenta actual) por separado de `orderId`, así mover ítems entre cuentas no altera la comanda.
- **Receta**: `ProductComponent` (producto → insumos) y `ModifierOptionComponent` (extra → insumos). Ejemplo: "Michelada" consume clamato y limón; la opción "Con Corona" consume 1 Corona y suma Q5; "Escarchado de tajín" consume 10 g.
- **Snapshots**: nombre, precio, extras y costo se copian al ítem al enviarlo; cambios posteriores al menú no alteran ventas pasadas. La utilidad sale de `unitPrice − unitCost`.
- **Costo promedio ponderado** en `InventoryItem.averageCost`, recalculado en cada compra.
- **InventoryMovement** es un historial inmutable con `stockAfter`. Todo cambio de stock ocurre dentro de una transacción junto con su movimiento.
- **Pagos múltiples por cuenta** → pago mixto y división en partes iguales. Dividir por ítems = mover ítems a una cuenta nueva (`splitFromId`).
- **Jornada**: `businessDate` (tipo `date`) se calcula en `America/Guatemala` al momento del cobro. Lo cobrado a las 00:30 pertenece al día siguiente.
- **Caja**: `CashSession` (apertura con fondo, arqueo al cierre, diferencia) + `CashMovement` (entradas/salidas que no son ventas). Solo una caja abierta a la vez.

## Estructura de carpetas

```
SanfeFer/
├── apps/
│   ├── api/
│   │   ├── prisma/            schema.prisma · migrations/ · seed.ts
│   │   ├── src/
│   │   │   ├── config/        env.ts (variables validadas con Zod)
│   │   │   ├── lib/           prisma.ts · errors.ts · money.ts · business-date.ts
│   │   │   ├── middleware/    auth.ts · require-role.ts · validate.ts · error-handler.ts · rate-limit.ts
│   │   │   ├── modules/       (cada uno: *.routes.ts · *.controller.ts · *.service.ts)
│   │   │   │   ├── auth/  users/  settings/
│   │   │   │   ├── catalog/       categorías, productos, modificadores, recetas
│   │   │   │   ├── inventory/     artículos, movimientos, alertas
│   │   │   │   ├── purchases/     proveedores, compras
│   │   │   │   ├── pos/           mesas, cuentas, comandas, pagos, tickets
│   │   │   │   ├── bar/           cola de preparación
│   │   │   │   ├── cash/          caja y cierre del día
│   │   │   │   └── reports/       consultas y exportación CSV
│   │   │   ├── app.ts · server.ts
│   │   └── tests/
│   └── web/
│       ├── public/            manifest, íconos PWA
│       ├── src/
│       │   ├── app/           router.tsx · providers.tsx · layouts/ (AdminLayout, PosLayout)
│       │   ├── components/ui/ Button, Input, Modal, Sheet, NumPad, Toast, DataTable, ThemeToggle
│       │   ├── features/      auth/ pos/ bar/ catalog/ inventory/ purchases/ cash/ reports/ users/ settings/
│       │   ├── printing/      TicketPreview (HTML 58/80 mm) · transports/ (browser, webusb, serial, bridge)
│       │   ├── lib/           api.ts · query-client.ts · format.ts
│       │   ├── stores/        theme.ts · draft-order.ts
│       │   └── styles/        tokens.css (paleta clara/oscura con variables CSS)
│       └── vercel.json
├── packages/
│   └── shared/src/            schemas/ (Zod) · totals.ts (cálculo de cuenta) · ticket/ (documento + encoder ESC/POS) · labels.ts (textos en español)
├── docker-compose.yml         Postgres local
├── .env.example
└── package.json
```

**Impresión**: el backend en Render no puede alcanzar una impresora de la red local, así que la impresión se hace desde el cliente. `packages/shared/ticket` genera un documento de ticket neutro → (a) se renderiza a HTML para vista previa e impresión con `window.print()`, (b) se codifica a bytes ESC/POS. Los transportes (WebUSB, Web Serial, puente local por red) se conectan después sin tocar la lógica.

## Paleta (inspirada en Guatemala, baja saturación)

| Token | Claro | Inspiración | Uso |
|---|---|---|---|
| primary | `#4F7F6A` | verde quetzal / jade | acciones principales |
| secondary | `#5E89AE` | azul celeste de la bandera | navegación, info |
| accent | `#B0634E` | rojo achiote / pecho del quetzal | peligro, cancelar |
| warning | `#C9A55A` | maíz amarillo | alertas de stock |
| highlight | `#8C7FA6` | jacaranda | estados "preparando" |
| surface | `#F5F1E8` / oscuro `#1E2226` | maíz blanco / piedra volcánica | fondos |
| earth | `#7A5C48` | barro | bordes, textos secundarios |

## Plan por fases

| Fase | Contenido | Cómo se prueba |
|---|---|---|
| **0. Fundaciones** | Monorepo, Docker Postgres, migración inicial, seed, Express base (errores en español, validación, health), React base (rutas, layouts, tema claro/oscuro), login (usuario+PIN / usuario+contraseña), roles, CRUD de usuarios | Entrar como admin y como vendedor; el vendedor solo ve el POS |
| **1. Catálogo e inventario** | Categorías, productos, grupos de modificadores, recetas, activar/desactivar; artículos de inventario, entradas/salidas/ajustes, historial, alertas de stock mínimo | Crear una michelada con extras y receta; ajustar stock y ver el historial |
| **2. Compras** | Proveedores, registro de compras (transacción: stock + movimiento + costo promedio), anulación | Registrar una compra y verificar stock y costo promedio |
| **3. POS: toma de orden** | Mapa de mesas, varias cuentas por mesa, clientes independientes, grilla rápida de productos, extras y notas, enviar a barra (descuenta inventario), pantalla de barra con estados, cancelación de ítems | Abrir una mesa con 2 clientes, enviar comandas desde el celular, avanzar estados en barra |
| **4. Cobro y caja** | Apertura de caja, descuentos, cargo por servicio, mover ítems / dividir cuenta, pagos en efectivo, tarjeta o mixtos con vuelto, ticket imprimible + base ESC/POS, arqueo y cierre, reporte del día | Ciclo completo: abrir caja → vender → cobrar → cerrar y cuadrar |
| **5. Reportes** | Dashboard, ventas por día/semana/mes, productos más/menos vendidos, ventas por vendedor, utilidad, estado de inventario, exportar CSV | Comparar los reportes con las ventas de prueba; abrir el CSV en Excel |
| **6. Pulido y despliegue** | PWA, revisión responsive y de accesibilidad, pruebas, Supabase + Render + Vercel, ping para evitar que el servidor se duerma | Usar la URL pública desde el celular |
