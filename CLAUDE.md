# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Paseo Seguro — Tour Booking App con Precios Dinámicos por Lluvia

## Stack
- **Backend**: Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Stripe · Zod — puerto 3000
- **Frontend**: Vite + React · TypeScript — puerto 5173
- **Tests**: Vitest — 43 pruebas en 6 suites, 100% pasando
- **BD**: PostgreSQL 16 (servicio Windows `postgresql-x64-16`)

## Comandos Frecuentes

### Desarrollo
```bash
npm run dev                    # Backend (Next.js) en :3000
cd frontend && npm run dev     # Frontend (Vite) en :5173
npm run typecheck             # Verificar tipos TypeScript
npm test                      # Ejecutar todas las pruebas (Vitest)
npm run test:watch            # Tests en modo watch
```

### Base de datos
```bash
npm run db:migrate            # Ejecutar migraciones Prisma
npm run db:generate           # Regenerar cliente Prisma
npm run db:studio             # Abrir Prisma Studio en localhost:5555
npm run db:reset              # Reset total (borra datos)
npm run db:seed               # Seed con datos de prueba
```

### Stripe
```bash
npm run stripe:listen         # Escuchar webhooks en localhost:3000/api/webhooks/stripe
```

## Estructura del Proyecto

```
pase_seguro/
├── src/                      # Backend (Next.js App Router)
│   ├── app/
│   │   ├── api/             # Endpoints REST
│   │   │   ├── bookings/    # Cotizaciones, checkout, confirmación
│   │   │   ├── tours/       # Catálogo de tours
│   │   │   ├── mock-pay/    # Simulación de pago Stripe
│   │   │   └── webhooks/    # Webhook de Stripe
│   │   ├── mock-pago/       # Terminal de pago simulada (página)
│   │   ├── reservas/        # Confirmación de reserva
│   │   └── tours/           # Detalle de tour
│   ├── lib/
│   │   ├── pricing/         # Cálculo de precios (regla de lluvia)
│   │   ├── weather/         # Open-Meteo API, ventana de reserva
│   │   ├── availability/    # Control de cupos por fecha/franja
│   │   ├── stripe/          # Cliente Stripe, manejo de eventos
│   │   ├── db.ts            # Cliente Prisma
│   │   └── env.ts           # Variables de entorno + validación
│   ├── components/          # Componentes del servidor
│   └── middleware.ts        # CORS, control de origen
│
├── frontend/                 # Frontend (Vite + React)
│   └── src/
│       ├── pages/           # Rutas (Landing, Tours, Detail, Confirmation)
│       ├── components/      # Componentes React
│       └── lib/             # API client, formato, tema, reglas de copy
│
├── backend/                  # Configuración de BD
│   └── prisma/
│       ├── schema.prisma    # Modelo de datos
│       ├── migrations/      # Historial de cambios BD
│       └── seed.ts          # Script de seed
│
└── [Configuración]
    ├── next.config.ts
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── .prismarc.json
    └── middleware.ts        # Re-exporta de src/middleware
```

## Arquitectura de Precios

**Regla de oro: El frontend NUNCA calcula precios.**

1. **Frontend obtiene una cotización** → POST `/api/bookings/quote`
   - Input: `tourId`, `bookingDate`, `timeSlot`, `passengersCount`
   - Output: `finalPriceCents` (precio unitario con descuento aplicado si aplica)

2. **Backend consulta el clima** → Open-Meteo API
   - Si lluvia prevista > 60% → descuento de 20% automático
   - Snapshot de condiciones se guarda en la cotización

3. **Usuario completa checkout** → POST `/api/bookings/checkout`
   - Servidor re-valida disponibilidad y precio (puede haber cambiado el pronóstico)
   - Si precio cambió → `409 PRICE_CHANGED`
   - Si cupos agotados → `409 CAPACITY_EXCEEDED`

4. **Cálculo final en BD**
   - `finalPriceCents × passengersCount = totalCharged`
   - Mock registra lo mismo que Stripe (`amountPaidCents`)

**Copy de marketing** (solo visual):
- Números como "60%", "20%", "14 días" → `frontend/src/lib/rules.ts`
- Valores reales (threshold, descuento) → `price.thresholdPct`, `price.discountBps` de la API

## Validación de Pasajeros

- **Rango válido**: 1 a 20 pasajeros (`src/app/api/bookings/quote/route.ts` línea 20)
- **Clampeo automático**: Si user intenta > disponible, se clampea en `BookingPanel.tsx`
- **Re-validación en server**: Al checkout, se verifica disponibilidad real

## URLs y Redirecciones (Puertos)

**Problema resuelto**: Frontend (`:5173`) → Backend (`:3000`) → Frontend (`:5173`)

- `FRONTEND_URL` en `src/lib/env.ts` = `http://localhost:5173`
- Checkout mock: `POST /api/mock-pay` redirige a `${FRONTEND_URL}/reservas/confirmacion?session_id=...`
- Stripe real: `success_url` y `cancel_url` en `src/app/api/bookings/checkout/route.ts` usan `FRONTEND_URL`

## Modo de Pago

### Mock Mode (desarrollo)
```
MOCK_STRIPE=true en .env.local
```
- Terminal simulada en `/mock-pago/[bookingId]`
- Validación Luhn, vencimiento, CVC, detección de marca
- Datos de tarjeta NUNCA salen del navegador
- Tarjetas de prueba:
  - `4242 4242 4242 4242` → Aprobado
  - `4000 0000 0000 9995` → Fondos insuficientes
  - `4000 0000 0000 0002` → Rechazada

### Stripe Real
```
MOCK_STRIPE=false en .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
npm run stripe:listen
```

## Diseño Visual

- **Tema**: Caribe — `--accent: #0d5a73` (azul), `--ok: #1c7554` (esmeralda)
- **Light/Dark**: Token único con `light-dark()` en `:root`
  - Explícito: `data-theme="light|dark"` en `<html>`
  - Automático (sin atributo): sigue sistema del SO
  - Selector: `ThemeToggle` en header, persistencia en `localStorage["paseo-theme"]`
- **Anti-parpadeo**: Scripts en `frontend/index.html` y `src/app/layout.tsx`
- **Hero**: Fondo oscuro en ambos temas (variables `--hero-*`)
- **Pencil design file**: `paseo-dise.pen` (raíz)
  - ⚠️ **Solo abre en Claude Desktop App**, NO en CLI

## Rutas del Frontend

| Ruta | Componente | Responsabilidad |
|---|---|---|
| `/` | `LandingPage` | Hero, cómo funciona, destinos destacados, regla de precio |
| `/tours` | `TourListPage` | Catálogo filtrable |
| `/tours/:slug` | `TourDetailPage` | Detalle + panel de reserva (fecha, franja, pasajeros, precio) |
| `/reservas/confirmacion` | `ConfirmationPage` | Estado de pago (polling + confirmación final) |
| `*` | `NotFound` | 404 |

## Flujo Crítico: Reserva Completa

1. User en `/tours/:slug` → selecciona fecha, franja, pasajeros
2. `BookingPanel` hace POST `/api/bookings/quote`
   - Si capac. excedida → error + clamping automático
   - Si fuera de ventana de pronóstico → advertencia
3. User completa nombre + email, hace clic "Pagar y reservar"
4. POST `/api/bookings/checkout` con `quoteToken`
   - Validación de precio y disponibilidad en transacción atómica
   - Si price cambió → 409, user vuelve a cotizar
   - Si capacidad cambió → 409, user elige otros pasajeros
5. Redirect a `/mock-pago/[bookingId]` (mock) o Stripe (real)
6. User completa pago
7. Redirect a `/reservas/confirmacion?session_id=...` (frontend)
8. Polling a `/api/bookings/by-session/[sessionId]` hasta confirmación
9. Estado pasa a `CONFIRMED` cuando webhook de Stripe se procesa (o mock finaliza)

## Cosas Críticas

- **Precios**: Server-side only. Frontend **nunca** calcula descuentos.
- **Transacciones**: Checkout es transacción atómica (check + create en una tx).
- **Idempotencia**: `processedWebhookEvent` previene confirmaciones dobles.
- **Cupos**: Control por fecha + franja. Max capacity = `Tour.maxCapacity`.
- **Disponibilidad**: Pending bookings se cuentan (hold window = 15 min).
- **Timestamps**: Usar ISO strings para fechas (YYYY-MM-DD).

## Trabajo Pendiente

- ✅ Tests + typecheck corriendo
- ✅ Puertos consistentes (redirecciones funcionan)
- ✅ Total en confirmación correcto (`finalPriceCents × passengersCount`)
- ⏳ **Activar Stripe real** — obtener claves de dashboard.stripe.com, correr `npm run stripe:listen`
- ⏳ **Despliegue** — Vercel (backend), servicio hosting (frontend) o ambos en un solo deploy
