# Publicar SanfeFer en internet

Guía paso a paso para dejar SanfeFer en línea con planes gratuitos. Se necesita la URL pública
para usarla desde los celulares del negocio.

| Pieza            | Dónde        | Qué hace                                           |
| ---------------- | ------------ | -------------------------------------------------- |
| Base de datos    | **Supabase** | PostgreSQL con todos los datos                     |
| API (`apps/api`) | **Render**   | Express + Prisma; aplica migraciones al arrancar   |
| Web (`apps/web`) | **Vercel**   | La app instalable (PWA); reenvía `/api/*` a Render |

```
Celular/PC ──https──▶ Vercel (tu-app.vercel.app)
                         ├─ /            → app (archivos estáticos)
                         └─ /api/*       → Render (sanfefer-api.onrender.com) ──▶ Supabase
```

La web y la API se ven como **un solo sitio** porque Vercel reenvía `/api`. Así la cookie de
sesión es "propia" y funciona en iPhone (Safari bloquea cookies de otros dominios) sin
configurar CORS.

> Tiempo estimado: 30–45 minutos. Necesitas tu cuenta de GitHub con este repositorio.
> Publica desde la rama `main` (fusiona antes el PR).

---

## 1. Supabase (base de datos)

1. Entra a [supabase.com](https://supabase.com) → **New project**.
   - **Name:** `sanfefer`.
   - **Database password:** genera una y guárdala. La necesitarás en el paso 3.
   - **Region:** _East US (North Virginia)_, la misma zona que Render en `render.yaml`.
2. Cuando termine de crearse, toca **Connect** (arriba) → pestaña **ORMs** → **Prisma**.
   Verás dos cadenas:
   - `DATABASE_URL`: el _pooler_ en **modo transacción**, puerto **6543**, con `?pgbouncer=true`.
   - `DIRECT_URL`: el _pooler_ en **modo sesión**, puerto **5432**. Lo usan las migraciones.
3. Reemplaza `[YOUR-PASSWORD]` por la contraseña del paso 1. Al final de `DATABASE_URL`
   agrega `&connection_limit=5`. Queda así:

   ```
   DATABASE_URL=postgresql://postgres.xxxx:CLAVE@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5
   DIRECT_URL=postgresql://postgres.xxxx:CLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

   > Si la contraseña tiene símbolos como `@`, `#` o `/`, cámbiala por una solo con letras y
   > números. Si no, hay que escaparlos en la URL.

No hace falta crear tablas: la API aplica las migraciones al arrancar.

## 2. Render (API)

1. Entra a [render.com](https://render.com) con tu cuenta de GitHub → **New** → **Blueprint**.
2. Elige el repositorio **SanfeFer**, rama `main`. Render lee `render.yaml` y propone el
   servicio **sanfefer-api** (plan Free).
3. Llena las variables que pide:

   | Variable         | Valor                                                            |
   | ---------------- | ---------------------------------------------------------------- |
   | `DATABASE_URL`   | La de Supabase, puerto 6543 (paso 1.3)                           |
   | `DIRECT_URL`     | La de Supabase, puerto 5432 (paso 1.3)                           |
   | `ADMIN_NAME`     | Tu nombre, p. ej. `Fernanda Sandoval`                            |
   | `ADMIN_USERNAME` | Usuario del administrador, p. ej. `fernanda`                     |
   | `ADMIN_PASSWORD` | Contraseña del administrador (mínimo 8 caracteres)               |
   | `ADMIN_PIN`      | PIN de 4 a 6 dígitos (opcional; sirve para autorizar descuentos) |

   `JWT_SECRET` se genera solo. `TRUST_PROXY`, `NODE_ENV` y los demás ya vienen en el archivo.

4. **Apply**. El primer despliegue tarda unos minutos. En **Logs** debes ver:

   ```
   All migrations have been successfully applied.
   ✅ Administrador inicial creado: "fernanda". Ya puedes entrar y borrar ADMIN_PASSWORD.
   ✅ API de SanfeFer escuchando en …
   ```

5. Copia la URL del servicio (arriba, p. ej. `https://sanfefer-api.onrender.com`) y ábrela
   agregando `/api/health`. Debe responder `{"status":"ok","db":"ok",…}`.

> **Si la URL de Render no es exactamente `https://sanfefer-api.onrender.com`** (Render agrega
> letras si el nombre ya está ocupado), edita `vercel.json` en la raíz del repositorio. Cambia
> la línea `"destination": "https://sanfefer-api.onrender.com/api/:path*"` por tu URL, haz
> commit y sube el cambio a `main` antes del paso 3.

## 3. Vercel (web)

1. Entra a [vercel.com](https://vercel.com) con tu cuenta de GitHub → **Add New…** →
   **Project** → importa **SanfeFer**.
2. Deja **Root Directory** en la raíz del repositorio (`./`). `vercel.json` ya indica cómo
   compilar (`npm run build -w @sanfefer/web`) y qué publicar (`apps/web/dist`). No hace falta
   ninguna variable de entorno.
3. **Deploy**. Al terminar tendrás una URL como `https://sanfefer.vercel.app`.
4. Ábrela, entra como administrador ("Entrar como administrador") con el usuario y la
   contraseña del paso 2.3, y revisa que se vean las pantallas.

## 4. Después del primer ingreso

1. **Render → Environment:** borra `ADMIN_PASSWORD`. Ya no se necesita: si ya existe un
   administrador, esas variables se ignoran. Guarda los cambios; Render reinicia la API.
2. En la app, como administrador:
   - **Ajustes:** nombre del negocio, dirección y teléfono del ticket, servicio por defecto y
     ancho de papel.
   - **Usuarios:** crea a los vendedores con su PIN.
   - **Inventario**, **Productos y menú** y **Compras:** carga tus artículos, recetas y
     proveedores.
   - En **Caja**, cada turno abre su caja desde el punto de venta.

### ¿Quieres probar con los datos de ejemplo?

El seed carga el menú y 8 semanas de ventas de prueba, pero **borra todo lo que haya** en la
base. Úsalo solo en una base nueva o de pruebas. Desde tu computadora, en la carpeta del
proyecto:

```bash
cd apps/api
DATABASE_URL="(la de 5432)" DIRECT_URL="(la de 5432)" SEED_FORCE=true npx prisma db seed
```

Después entra con `admin` / `Sanfefer2026` y cambia esa contraseña en **Usuarios**.

## 5. Que no se duerma

Con el plan gratuito, Render **apaga la API tras 15 minutos sin uso**. La siguiente visita
tarda hasta un minuto en responder. Para evitarlo en horario de trabajo, haz que algo la visite
cada pocos minutos. Elige **una** opción:

- **UptimeRobot** (recomendado, gratis): crea un monitor _HTTP(s)_ a
  `https://TU-API.onrender.com/api/health` cada 5 minutos. También te avisa por correo si la
  API se cae.
- **GitHub Actions** (incluido en el repo: `.github/workflows/keep-awake.yml`): en GitHub →
  **Settings → Secrets and variables → Actions → Variables** crea `API_HEALTH_URL` con esa
  misma URL. Llama a la API cada 10 minutos de 15:00 a 01:00, hora de Guatemala.
  > En repositorios **privados** esto gasta minutos de Actions (unos 1,800 al mes de los 2,000
  > gratis). Ahí usa UptimeRobot.

Cualquiera de las dos también evita que Supabase pause el proyecto. Supabase pausa los
proyectos gratuitos que pasan una semana sin actividad.

## 6. Instalar la app en los celulares

Abre la URL de Vercel en el celular de cada vendedor:

- **Android (Chrome):** toca **Instalar app** en la pantalla de ingreso, o ⋮ → _Instalar
  aplicación_.
- **iPhone/iPad (Safari):** toca **Instalar app** y sigue las instrucciones: _Compartir_ →
  _Agregar a inicio_.

Queda un ícono de SanfeFer que abre la app a pantalla completa. Si se va el internet, la app
igual abre y avisa que no hay conexión. La orden que se esté tomando se guarda en el
dispositivo hasta poder enviarla.

## 7. Actualizaciones

Cada cambio que se fusione en `main` se publica solo:

- **Render** compila la API, aplica las migraciones nuevas y reinicia.
- **Vercel** publica la web nueva.
- En los dispositivos abiertos aparece **"Hay una versión nueva de SanfeFer · Actualizar"**.
  Nunca se recarga sola en medio de un cobro; el vendedor elige cuándo actualizar.

La integración continua (`.github/workflows/ci.yml`) revisa formato, tipos, lint, pruebas
(con una base PostgreSQL propia) y build en cada PR.

## 8. Respaldos

Los planes gratuitos de Supabase no ofrecen respaldos que puedas descargar. Haz los tuyos de
vez en cuando, por ejemplo cada semana, con `pg_dump` (viene con PostgreSQL) y la
`DIRECT_URL`:

```bash
pg_dump "postgresql://postgres.xxxx:CLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -Fc -f sanfefer-$(date +%F).dump
```

Para restaurar en una base vacía: `pg_restore -d "(URL de la base nueva)" --no-owner sanfefer-AAAA-MM-DD.dump`.
Los reportes también se pueden exportar a CSV desde **Reportes**.

## Problemas comunes

| Síntoma                                                                                | Causa y solución                                                                                                                             |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| La primera carga del día tarda o dice "El servidor tuvo un problema"                   | La API gratuita estaba dormida: espera un minuto y recarga. Configura el paso 5.                                                             |
| En Render: `❌ Variables de entorno inválidas`                                         | Falta una variable o es inválida (p. ej. `JWT_SECRET` corto). El mensaje dice cuál.                                                          |
| En Render: `Can't reach database server`                                               | Revisa `DATABASE_URL` y `DIRECT_URL` (contraseña, puertos 6543 y 5432). Si Supabase pausó el proyecto, reactívalo en su panel.               |
| Render responde en `/api/health`, pero la web dice "No se pudo completar la solicitud" | `vercel.json` apunta a otra URL de Render. Corrígela (paso 2) y vuelve a publicar.                                                           |
| Entras pero al recargar te saca                                                        | Estás usando la URL de Render en vez de la de Vercel. Usa siempre la de Vercel.                                                              |
| "Demasiados intentos de ingreso"                                                       | Muchos intentos fallidos desde el mismo celular: espera 5 minutos. Si les pasa a todos a la vez, revisa que `TRUST_PROXY` sea `2` en Render. |
| No aparece "Instalar app"                                                              | Ya está instalada, o el navegador no lo permite (en iPhone solo funciona desde Safari).                                                      |

## Costos y límites del plan gratuito

- **Render Free:** se duerme tras 15 minutos sin uso y no se recomienda para producción. Para
  tenerla siempre encendida, cambia a un plan de pago desde el panel. No hay que cambiar nada
  del código.
- **Supabase Free:** 500 MB de base de datos, de sobra para años de ventas de un negocio así.
  Se pausa tras una semana sin actividad.
- **Vercel Hobby:** gratuito para uso personal. Para un negocio, Vercel pide el plan Pro.
  Alternativas sin costo para la web: Netlify o Cloudflare Pages, con la misma idea de reenviar
  `/api`.

Revisa los precios y límites vigentes en cada proveedor: cambian con el tiempo.
