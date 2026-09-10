# PROTIN — Instrucciones del Proyecto Paseo Seguro

## Stack
- **Backend**: Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Stripe · Zod — puerto 3000
- **Frontend**: Vite + React · TypeScript — puerto 5173
- **Tests**: Vitest — 43 pruebas en 6 suites

## Cómo arrancar el proyecto
1. PostgreSQL ya corre como servicio Windows (`postgresql-x64-16`) — no se necesita Docker
2. `npm run dev` → backend en `:3000`
3. `cd frontend && npm run dev` → frontend en `:5173`
4. Las variables de entorno están en `.env.local` (no commitear)

## Regla de oro — Precios
El frontend NUNCA calcula ni envía precios. Todo pricing vive en `src/lib/pricing/engine.ts` y se computa server-side. Cualquier campo de precio en el body de un request debe retornar `400 UNEXPECTED_FIELD`.

Los números que aparecen en textos de marketing (60 %, 20 %, 14 días) viven en `frontend/src/lib/rules.ts` y son **solo copy**: el umbral y el descuento reales llegan siempre en `price.thresholdPct` / `price.discountBps` de la cotización.

## Modo de pago actual
`MOCK_STRIPE=true` en `.env.local`. El checkout redirige a `/mock-pago/[bookingId]` en lugar de Stripe real. Para activar Stripe real: obtener claves en dashboard.stripe.com y correr `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### Terminal de pago simulada
`/mock-pago/[bookingId]` imita Stripe Checkout: resumen del pedido a la izquierda y formulario de tarjeta a la derecha (validación Luhn, vencimiento, CVC, detección de marca). **Los datos de tarjeta nunca salen del navegador**: a `/api/mock-pay` solo se envía `{ bookingId, action }`. El desenlace lo decide el número:

| Tarjeta de prueba | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pago aprobado → `CONFIRMED` |
| `4000 0000 0000 9995` | Fondos insuficientes → `PAYMENT_FAILED` |
| `4000 0000 0000 0002` | Tarjeta rechazada → `PAYMENT_FAILED` |
| cualquier otra válida | Pago aprobado |

El mock registra `amountPaidCents = finalPriceCents × passengersCount`, igual que `session.amount_total` de Stripe real.

## Diseño visual
- Tema: Caribe — `--accent: #0d5a73` (azul), `--ok: #1c7554` (esmeralda), ámbar para alertas
- **Light/dark global**: un solo token por color con `light-dark()` en `:root`; el tema explícito se fija con `data-theme="light|dark"` en `<html>` (sin atributo = automático según el sistema). Selector de 3 estados en la cabecera (`ThemeToggle`), preferencia en `localStorage["paseo-theme"]` y script anti-parpadeo en `frontend/index.html` y en `src/app/layout.tsx`.
- El hero de la landing mantiene fondo oscuro en ambos temas (`--hero-*`).
- Archivo de diseño Pencil: `paseo-dise.pen` en la raíz del proyecto
- **IMPORTANTE**: Pencil MCP solo funciona desde **Claude Desktop App**, NO desde Claude Code CLI. Si se necesita diseñar con Pencil, indicar a Destruct que abra el proyecto desde la Claude Desktop App.

## Pencil — Flujo de trabajo
1. Abrir **Claude Desktop App**
2. Abrir este proyecto (`C:\Users\joels\Desktop\pase_seguro`)
3. Abrir `paseo-dise.pen` en la app Pencil de escritorio
4. Las herramientas `mcp__pencil__execute` y `mcp__pencil__get_app_state` funcionarán correctamente

## Arquitectura de rutas (frontend)
| Ruta | Componente |
|---|---|
| `/` | `LandingPage` — hero full-screen, cómo funciona, destacados, regla de precio |
| `/tours` | `TourListPage` (catálogo) |
| `/tours/:slug` | `TourDetailPage` |
| `/reservas/confirmacion` | `ConfirmationPage` |
| `*` | `NotFound` |

## Trabajo pendiente
- Correr `npm test` (43 pruebas) y `npm run typecheck` en el backend tras los últimos cambios de UI
- Unificar la confirmación: hoy el checkout mock redirige a `:3000/reservas/confirmacion`, mientras el usuario venía de `:5173`
- `ConfirmationView` muestra `finalPriceCents` (precio unitario) como "Total"; debería ser × `passengersCount`
- Activar Stripe real (claves + `stripe listen`) cuando se salga de modo mock
