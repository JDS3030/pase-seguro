# Paseo Seguro — proyecto completo

Reserva de tours con descuento dinámico por clima y cobro con Stripe.
Frontend y backend, listos para copiar archivo por archivo.

**Stack:** Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Zod · Stripe · Vitest
**Regla de negocio:** si la probabilidad de lluvia para la fecha y franja del tour **supera** el 60 %, se aplica un 20 % de descuento.
**Regla de oro:** el frontend nunca calcula, define ni envía un precio.

---

## Cómo usar este documento

Cada sección con un encabezado `### ruta/del/archivo` es un archivo del proyecto. El bloque de código que le sigue es su contenido íntegro: créalo tal cual, sin recortar.

Si trabajas con un agente de código (Claude Code, Codex, Copilot), pásale este documento entero y pídele que cree la estructura. Si lo haces a mano, sigue el orden de las secciones: están ordenadas por dependencia, de modo que ningún archivo importa algo que todavía no existe.

Al final, la sección 11 tiene la puesta en marcha paso a paso y la 12 la lista de verificación.

---

## 0. Requisitos

| Requisito | Versión | Comprobación |
|---|---|---|
| Node.js | 20 LTS o superior | `node -v` |
| Docker Desktop | cualquiera reciente | `docker -v` |
| Stripe CLI | 1.19+ | `stripe -v` |
| Cuenta de Stripe | modo prueba | claves `sk_test_…` |

En Windows, ejecuta todo desde **PowerShell** o desde la terminal integrada de VS Code, con Docker Desktop abierto.

Open-Meteo no necesita clave para uso no comercial. Sus límites gratuitos son 600 llamadas por minuto, 10 000 al día y 300 000 al mes; el proyecto los respeta con caché de 30 minutos.

---

## 1. Estructura de carpetas

```
paseo-seguro/
├─ docker-compose.yml
├─ package.json
├─ tsconfig.json
├─ next.config.ts
├─ vitest.config.ts
├─ .env.example
├─ .env.local                  ← lo creas tú, no se versiona
├─ .gitignore
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
└─ src/
   ├─ app/
   │  ├─ layout.tsx
   │  ├─ globals.css
   │  ├─ page.tsx                              catálogo
   │  ├─ tours/[slug]/page.tsx                 detalle
   │  ├─ reservas/confirmacion/page.tsx        confirmación
   │  └─ api/
   │     ├─ tours/route.ts
   │     ├─ tours/[idOrSlug]/route.ts
   │     ├─ bookings/quote/route.ts
   │     ├─ bookings/checkout/route.ts
   │     ├─ bookings/by-session/[sessionId]/route.ts
   │     └─ webhooks/stripe/route.ts
   ├─ components/
   │  ├─ BookingPanel.tsx                      cliente
   │  ├─ WeatherBadge.tsx
   │  └─ ConfirmationView.tsx                  cliente
   └─ lib/
      ├─ env.ts
      ├─ db.ts
      ├─ http.ts
      ├─ rate-limit.ts
      ├─ format.ts
      ├─ weather/
      │  ├─ open-meteo.ts
      │  ├─ window.ts
      │  └─ service.ts
      ├─ pricing/
      │  ├─ engine.ts
      │  └─ quote-token.ts
      └─ stripe/
         ├─ client.ts
         └─ handle-event.ts
```

---

## 2. Configuración del proyecto

### package.json

```json
{
  "name": "paseo-seguro",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:reset": "prisma migrate reset --force",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "stripe:listen": "stripe listen --forward-to localhost:3000/api/webhooks/stripe",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.2.1",
    "next": "^15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "stripe": "^17.5.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "@types/react": "^19.0.7",
    "@types/react-dom": "^19.0.3",
    "prisma": "^6.2.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El webhook necesita el cuerpo crudo. En App Router eso ya funciona
  // con req.text(), así que no hace falta desactivar ningún bodyParser.
};

export default nextConfig;
```

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: paseo-seguro-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: paseo
      POSTGRES_PASSWORD: paseo
      POSTGRES_DB: paseo_seguro
    ports:
      - "5432:5432"
    volumes:
      - paseo-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U paseo -d paseo_seguro"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  paseo-data:
```

### .env.example

```ini
# ── Base de datos ──────────────────────────────────────────────────
DATABASE_URL="postgresql://paseo:paseo@localhost:5432/paseo_seguro"

# ── Stripe (modo prueba) ───────────────────────────────────────────
# NUNCA prefijes estas con NEXT_PUBLIC_: acabarían en el navegador.
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."      # el que imprime `stripe listen`

# ── Open-Meteo ─────────────────────────────────────────────────────
OPEN_METEO_BASE_URL="https://api.open-meteo.com/v1/forecast"
OPEN_METEO_GEOCODING_URL="https://geocoding-api.open-meteo.com/v1/search"

# ── Reglas de negocio ──────────────────────────────────────────────
RAIN_THRESHOLD_PCT=60                  # descuento si la lluvia SUPERA este valor
WEATHER_DISCOUNT_BPS=2000              # 2000 puntos básicos = 20,00 %
FORECAST_MAX_DAYS=14                   # Open-Meteo admite hasta 16
WEATHER_CACHE_TTL_SECONDS=1800         # 30 min
WEATHER_STALE_TOLERANCE_SECONDS=21600  # 6 h

# ── Aplicación ─────────────────────────────────────────────────────
APP_URL="http://localhost:3000"
QUOTE_SIGNING_SECRET="cambia-esto"     # genera uno: openssl rand -base64 32
```

### .gitignore

```
node_modules/
.next/
out/
build/
.env
.env.local
.env*.local
*.log
.DS_Store
coverage/
.vercel
next-env.d.ts
```

### vitest.config.ts

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // src/lib/env.ts valida process.env al cargarse y lanza si falta algo,
    // así que las pruebas necesitan valores. Los de Stripe son ficticios a
    // propósito: la prueba del webhook firma y verifica con el mismo secreto,
    // de modo que cualquier valor consistente sirve.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://paseo:paseo@localhost:5432/paseo_seguro",
      STRIPE_SECRET_KEY: "sk_test_ficticia_para_pruebas",
      STRIPE_WEBHOOK_SECRET: "whsec_ficticio_para_pruebas",
      QUOTE_SIGNING_SECRET: "secreto-de-pruebas-no-usar-en-produccion",
      APP_URL: "http://localhost:3000",
    },
  },
});
```

---

## 3. Base de datos

### prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum BookingStatus {
  PENDING
  CONFIRMED
  PAYMENT_FAILED
  EXPIRED
  CANCELLED
}

enum TimeSlot {
  MORNING
  AFTERNOON
  EVENING
}

model Tour {
  id             String   @id @default(cuid())
  slug           String   @unique
  title          String
  description    String
  locationName   String
  countryCode    String   @db.Char(2)
  latitude       Float
  longitude      Float
  timezone       String
  basePriceCents Int
  currency       String   @db.Char(3)
  durationMin    Int
  slots          TimeSlot[]
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  bookings Booking[]

  @@index([active, countryCode])
}

model Booking {
  id     String @id @default(cuid())
  tourId String
  tour   Tour   @relation(fields: [tourId], references: [id])

  customerName  String
  customerEmail String
  bookingDate   DateTime @db.Date
  timeSlot      TimeSlot

  // Precio congelado en el momento del checkout.
  basePriceCents     Int
  discountBps        Int    @default(0)
  discountCents      Int    @default(0)
  finalPriceCents    Int
  currency           String @db.Char(3)
  pricingRuleVersion String
  weatherSnapshot    Json

  status                BookingStatus @default(PENDING)
  stripeSessionId       String?       @unique
  stripePaymentIntentId String?       @unique
  amountPaidCents       Int?
  confirmedAt           DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@index([status, createdAt])
  @@index([customerEmail, createdAt])
  @@index([tourId, bookingDate])
}

// Candado de idempotencia: la clave primaria ES el id del evento de Stripe.
// Un segundo INSERT del mismo evento viola la restricción y aborta la
// transacción antes de tocar la reserva.
model ProcessedWebhookEvent {
  id          String   @id
  type        String
  bookingId   String?
  processedAt DateTime @default(now())

  @@index([bookingId])
}

// Caché del pronóstico: protege la cuota de Open-Meteo y garantiza que
// la cotización y el cobro vean el mismo número dentro del TTL.
model WeatherCache {
  key       String   @id
  payload   Json
  fetchedAt DateTime @default(now())
  expiresAt DateTime

  @@index([expiresAt])
}
```

### prisma/seed.ts

Las coordenadas y la zona horaria **no se escriben a mano**: las resuelve la API de geocodificación de Open-Meteo. Ese es el requisito de geocodificación, cubierto en un paso reproducible.

```ts
import { PrismaClient, TimeSlot } from "@prisma/client";

const prisma = new PrismaClient();
const GEO = process.env.OPEN_METEO_GEOCODING_URL
  ?? "https://geocoding-api.open-meteo.com/v1/search";

type GeoResult = {
  latitude: number;
  longitude: number;
  timezone: string;
  locationName: string;
  countryCode: string;
};

async function geocode(query: string, countryCode = "DO"): Promise<GeoResult> {
  const url = new URL(GEO);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "es");
  url.searchParams.set("countryCode", countryCode);
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding HTTP ${res.status} para "${query}"`);

  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  const hit = data.results?.[0];
  if (!hit) throw new Error(`sin coordenadas para "${query}"`);

  return {
    latitude: hit.latitude as number,
    longitude: hit.longitude as number,
    timezone: hit.timezone as string,
    locationName: [hit.name, hit.admin1].filter(Boolean).join(", "),
    countryCode: hit.country_code as string,
  };
}

const CATALOGO = [
  {
    slug: "isla-saona-catamaran",
    title: "Isla Saona en catamarán",
    query: "Bayahibe",
    description:
      "Travesía en catamarán hasta Isla Saona con parada en la piscina natural, almuerzo criollo en la playa y regreso en lancha rápida por el Parque Nacional del Este.",
    basePriceCents: 8900,
    durationMin: 480,
    slots: [TimeSlot.MORNING],
  },
  {
    slug: "bahia-de-las-aguilas",
    title: "Bahía de las Águilas",
    query: "Pedernales",
    description:
      "Ocho kilómetros de playa virgen dentro del Parque Nacional Jaragua. Traslado en bote desde Cabo Rojo, sin infraestructura ni sombra: el pronóstico importa.",
    basePriceCents: 12000,
    durationMin: 600,
    slots: [TimeSlot.MORNING],
  },
  {
    slug: "salto-el-limon",
    title: "Salto El Limón a caballo",
    query: "Samaná",
    description:
      "Cabalgata de cuarenta minutos por senderos de montaña hasta una cascada de 52 metros, con tiempo para bañarse en la poza.",
    basePriceCents: 5500,
    durationMin: 240,
    slots: [TimeSlot.MORNING, TimeSlot.AFTERNOON],
  },
  {
    slug: "los-haitises-en-bote",
    title: "Los Haitises en bote",
    query: "Sabana de la Mar",
    description:
      "Recorrido entre mogotes y manglares, con visita a cuevas de pictografías taínas y avistamiento de aves en la bahía de San Lorenzo.",
    basePriceCents: 7200,
    durationMin: 300,
    slots: [TimeSlot.MORNING, TimeSlot.AFTERNOON],
  },
  {
    slug: "27-charcos-damajagua",
    title: "27 Charcos de Damajagua",
    query: "Imbert",
    description:
      "Ascenso por el cañón del río Damajagua y descenso saltando y deslizándose por las 27 pozas. Con casco, chaleco y guía local.",
    basePriceCents: 4999,
    durationMin: 300,
    slots: [TimeSlot.MORNING, TimeSlot.AFTERNOON],
  },
  {
    slug: "amanecer-pico-duarte",
    title: "Amanecer en Pico Duarte",
    query: "Jarabacoa",
    description:
      "Ascenso guiado de dos días al techo del Caribe, con campamento en La Compartición y salida nocturna para llegar a la cumbre al amanecer.",
    basePriceCents: 21000,
    durationMin: 2880,
    slots: [TimeSlot.MORNING],
  },
];

async function main() {
  for (const t of CATALOGO) {
    const geo = await geocode(t.query);
    const { query: _query, ...rest } = t;

    await prisma.tour.upsert({
      where: { slug: t.slug },
      update: { ...rest, ...geo, currency: "USD" },
      create: { ...rest, ...geo, currency: "USD" },
    });

    console.log(
      `  ✓ ${t.title.padEnd(30)} ${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}  ${geo.timezone}`,
    );

    // Amable con el límite de 600 llamadas por minuto.
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`\n${CATALOGO.length} tours sembrados con coordenadas resueltas por la API.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

---

## 4. Núcleo del backend

### src/lib/env.ts

Valida la configuración al arrancar. Un `.env` incompleto falla aquí, con un mensaje claro, en lugar de producir un `undefined` que revienta a mitad de un cobro.

```ts
import { z } from "zod";

const Schema = z.object({
  DATABASE_URL: z.string().url(),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  OPEN_METEO_BASE_URL: z.string().url().default("https://api.open-meteo.com/v1/forecast"),
  OPEN_METEO_GEOCODING_URL: z
    .string()
    .url()
    .default("https://geocoding-api.open-meteo.com/v1/search"),

  RAIN_THRESHOLD_PCT: z.coerce.number().int().min(0).max(100).default(60),
  WEATHER_DISCOUNT_BPS: z.coerce.number().int().min(0).max(10_000).default(2000),
  FORECAST_MAX_DAYS: z.coerce.number().int().min(1).max(16).default(14),
  WEATHER_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  WEATHER_STALE_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(21_600),

  APP_URL: z.string().url().default("http://localhost:3000"),
  QUOTE_SIGNING_SECRET: z.string().min(16),
});

const parsed = Schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuración inválida:", parsed.error.flatten().fieldErrors);
  throw new Error("Revisa tu .env.local contra .env.example");
}

export const env = parsed.data;
```

### src/lib/db.ts

```ts
import { PrismaClient } from "@prisma/client";

// En desarrollo, Next recarga los módulos en caliente. Sin este singleton
// cada recarga abriría un pool nuevo hasta agotar las conexiones de Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### src/lib/http.ts

```ts
import { NextResponse } from "next/server";

export function requestId(): string {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

export function fail(
  status: number,
  code: string,
  message?: string,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message: message ?? code, details }, requestId: requestId() },
    { status },
  );
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Mensajes en español para los códigos de error del dominio. */
export const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Los datos enviados no son válidos.",
  UNEXPECTED_FIELD: "La petición incluye campos que no se aceptan.",
  TOUR_NOT_FOUND: "No encontramos ese tour.",
  DATE_IN_PAST: "La fecha seleccionada ya pasó.",
  DATE_TOO_FAR: "La fecha seleccionada excede el máximo de 365 días.",
  SLOT_NOT_OFFERED: "Ese tour no se ofrece en la franja seleccionada.",
  QUOTE_EXPIRED: "Tu cotización caducó. Vuelve a consultar el precio.",
  PRICE_CHANGED: "El pronóstico cambió desde tu cotización.",
  RATE_LIMITED: "Demasiadas peticiones. Espera un momento.",
  PAYMENT_PROVIDER_ERROR: "No pudimos iniciar el pago. Inténtalo de nuevo.",
  BOOKING_NOT_FOUND: "No encontramos esa reserva.",
};
```

### src/lib/rate-limit.ts

```ts
// Limitador en memoria: suficiente para desarrollo y para una sola instancia.
// En producción con varias réplicas, sustitúyelo por Redis o Upstash;
// la firma de la función no cambia.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count) };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "local";
}

// Limpieza periódica para que el Map no crezca sin límite.
if (typeof setInterval === "function") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }, 60_000).unref?.();
}
```

### src/lib/format.ts

```ts
import type { TimeSlot } from "@prisma/client";

export const SLOT_LABEL: Record<TimeSlot, string> = {
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  EVENING: "Noche",
};

export const SLOT_RANGE: Record<TimeSlot, string> = {
  MORNING: "06:00 – 12:00",
  AFTERNOON: "12:00 – 18:00",
  EVENING: "18:00 – 23:00",
};

/**
 * Único lugar donde los centavos se convierten a texto.
 * Asume monedas de dos decimales. Si algún día se factura en JPY o CLP,
 * este helper es el que cambia, no las 30 llamadas repartidas por la app.
 */
export function formatMoney(cents: number, currency: string, locale = "es-DO"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDate(date: string, locale = "es-DO"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** Prisma devuelve @db.Date como Date a medianoche UTC. */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

---

## 5. Servicio de clima

Tres archivos con responsabilidades separadas a propósito: `open-meteo.ts` habla con la red, `window.ts` decide si la fecha es evaluable, y `service.ts` añade caché, reintento y degradación. Solo el primero hace `fetch`, así que los otros dos se prueban sin red.

### src/lib/weather/open-meteo.ts

```ts
import { z } from "zod";
import { env } from "@/lib/env";

const ForecastSchema = z.object({
  timezone: z.string(),
  hourly: z
    .object({
      time: z.array(z.string()),
      precipitation_probability: z.array(z.number().nullable()),
    })
    .optional(),
  daily: z
    .object({
      time: z.array(z.string()),
      precipitation_probability_max: z.array(z.number().nullable()),
    })
    .optional(),
});

export type ForecastResponse = z.infer<typeof ForecastSchema>;

export const SLOT_HOURS = {
  MORNING: [6, 7, 8, 9, 10, 11],
  AFTERNOON: [12, 13, 14, 15, 16, 17],
  EVENING: [18, 19, 20, 21, 22],
} as const;

export type SlotKey = keyof typeof SLOT_HOURS;

export type ForecastStatus =
  | "FORECAST_OK"
  | "FORECAST_STALE"
  | "FORECAST_OUT_OF_RANGE"
  | "WEATHER_UNAVAILABLE";

export interface WeatherReading {
  status: ForecastStatus;
  /** 0–100, o null si no hubo dato utilizable. */
  rainProbability: number | null;
  source: "LIVE" | "CACHE" | "STALE_CACHE" | "NONE";
  aggregation: "max" | "daily_max" | null;
  slot: SlotKey | null;
  hourlyUsed: { time: string; value: number }[];
  endpoint: string | null;
  params: Record<string, string> | null;
  fetchedAt: string;
}

const TIMEOUT_MS = 2_500;

export class WeatherProviderError extends Error {}

export function emptyReading(status: ForecastStatus): WeatherReading {
  return {
    status,
    rainProbability: null,
    source: "NONE",
    aggregation: null,
    slot: null,
    hourlyUsed: [],
    endpoint: null,
    params: null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Transporte puro: una llamada, sin caché ni fallback.
 * Lanza WeatherProviderError; quien decide qué hacer con el fallo es service.ts.
 */
export async function fetchForecast(input: {
  latitude: number;
  longitude: number;
  timezone: string;
  /** YYYY-MM-DD en la zona horaria del destino. */
  date: string;
  slot: SlotKey;
}): Promise<WeatherReading> {
  const params: Record<string, string> = {
    latitude: input.latitude.toFixed(4),
    longitude: input.longitude.toFixed(4),
    hourly: "precipitation_probability",
    daily: "precipitation_probability_max",
    // Con timezone, el array "time" viene en hora LOCAL del destino,
    // que es justo el marco en el que razona el resto del sistema.
    timezone: input.timezone,
    start_date: input.date,
    end_date: input.date, // un solo día = 1 llamada de cuota
  };

  const url = new URL(env.OPEN_METEO_BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    throw new WeatherProviderError(`red o timeout: ${(err as Error).message}`);
  }

  if (res.status === 429) throw new WeatherProviderError("rate limit (429)");
  if (!res.ok) throw new WeatherProviderError(`HTTP ${res.status}`);

  const parsed = ForecastSchema.safeParse(await res.json());
  if (!parsed.success) throw new WeatherProviderError("respuesta con forma inesperada");

  const { value, used, aggregation } = extractSlotProbability(
    parsed.data,
    input.date,
    input.slot,
  );

  return {
    status: "FORECAST_OK",
    rainProbability: value,
    source: "LIVE",
    aggregation,
    slot: input.slot,
    hourlyUsed: used,
    endpoint: url.origin + url.pathname,
    params,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * De la respuesta cruda a un solo número. Función pura: es la que se prueba.
 *
 * Se agrega con max() y no con promedio: si llueve fuerte durante dos de las
 * seis horas del tour, el tour se moja. El promedio escondería ese caso.
 */
export function extractSlotProbability(
  data: ForecastResponse,
  date: string,
  slot: SlotKey,
): {
  value: number | null;
  used: { time: string; value: number }[];
  aggregation: "max" | "daily_max" | null;
} {
  const wanted = new Set(
    SLOT_HOURS[slot].map((h) => `${date}T${String(h).padStart(2, "0")}:00`),
  );

  const used: { time: string; value: number }[] = [];
  data.hourly?.time.forEach((t, i) => {
    const v = data.hourly?.precipitation_probability[i];
    if (wanted.has(t) && typeof v === "number") used.push({ time: t, value: v });
  });

  if (used.length > 0) {
    return { value: Math.max(...used.map((u) => u.value)), used, aggregation: "max" };
  }

  // Respaldo: el máximo diario, por si la franja horaria no vino completa.
  const dayIdx = data.daily?.time.indexOf(date) ?? -1;
  const daily = dayIdx >= 0 ? data.daily?.precipitation_probability_max[dayIdx] : null;

  return {
    value: typeof daily === "number" ? daily : null,
    used,
    aggregation: typeof daily === "number" ? "daily_max" : null,
  };
}
```

### src/lib/weather/window.ts

La comparación se hace contra el día de hoy **en la zona del destino**. Un servidor en UTC que use su propio calendario rechaza reservas válidas de esta noche en Santo Domingo.

```ts
import { env } from "@/lib/env";

export const FORECAST_MAX_DAYS = env.FORECAST_MAX_DAYS;
export const BOOKING_MAX_DAYS = 365;

/** "Hoy" según el reloj del destino, en formato YYYY-MM-DD. */
export function todayInTimezone(timezone: string, now = new Date()): string {
  // en-CA produce exactamente YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysAhead(date: string, timezone: string, now = new Date()): number {
  const today = Date.parse(`${todayInTimezone(timezone, now)}T00:00:00Z`);
  const target = Date.parse(`${date}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

export type WindowCheck =
  | { ok: true; days: number; withinForecast: boolean }
  | { ok: false; code: "DATE_IN_PAST" | "DATE_TOO_FAR" };

export function checkBookingWindow(
  date: string,
  timezone: string,
  now = new Date(),
): WindowCheck {
  const days = daysAhead(date, timezone, now);
  if (days < 0) return { ok: false, code: "DATE_IN_PAST" };
  if (days > BOOKING_MAX_DAYS) return { ok: false, code: "DATE_TOO_FAR" };
  return { ok: true, days, withinForecast: days <= FORECAST_MAX_DAYS };
}

/** Rango que el selector de fechas del frontend debe ofrecer. */
export function forecastWindow(timezone: string, now = new Date()) {
  const today = todayInTimezone(timezone, now);
  const base = Date.parse(`${today}T00:00:00Z`);
  const plus = (d: number) => new Date(base + d * 86_400_000).toISOString().slice(0, 10);
  return {
    minDate: today,
    maxForecastDate: plus(FORECAST_MAX_DAYS),
    maxDate: plus(BOOKING_MAX_DAYS),
  };
}
```

### src/lib/weather/service.ts

Nunca lanza: siempre devuelve un `WeatherReading`, aunque sea el de "no sé". Una caída de Open-Meteo degrada al precio base, jamás bloquea la compra.

```ts
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  fetchForecast,
  emptyReading,
  type SlotKey,
  type WeatherReading,
} from "./open-meteo";
import { checkBookingWindow } from "./window";

const FRESH_MS = env.WEATHER_CACHE_TTL_SECONDS * 1000;
const STALE_MS = env.WEATHER_STALE_TOLERANCE_SECONDS * 1000;

// Cortocircuito: tras 3 fallos seguidos deja de intentarlo durante 60 s,
// para no castigar cada petición con dos timeouts de 2,5 s.
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

const circuitOpen = () => Date.now() < circuitOpenUntil;

function recordSuccess() {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

function recordFailure(err: unknown) {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    console.warn("[weather] cortocircuito abierto 60 s tras", consecutiveFailures, "fallos");
  }
  console.warn("[weather] fallo del proveedor:", (err as Error).message);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getRainProbability(
  tour: { latitude: number; longitude: number; timezone: string },
  date: string,
  slot: SlotKey,
): Promise<WeatherReading> {
  const win = checkBookingWindow(date, tour.timezone);
  if (!win.ok || !win.withinForecast) return emptyReading("FORECAST_OUT_OF_RANGE");

  const key = `${tour.latitude},${tour.longitude}|${date}|${slot}`;

  const cached = await prisma.weatherCache.findUnique({ where: { key } }).catch(() => null);
  const age = cached ? Date.now() - cached.fetchedAt.getTime() : Number.POSITIVE_INFINITY;

  if (cached && age < FRESH_MS) {
    return { ...(cached.payload as unknown as WeatherReading), source: "CACHE" };
  }

  if (circuitOpen()) return degrade(cached, age);

  for (const attempt of [0, 1]) {
    try {
      const reading = await fetchForecast({ ...tour, date, slot });

      await prisma.weatherCache.upsert({
        where: { key },
        create: {
          key,
          payload: reading as unknown as object,
          expiresAt: new Date(Date.now() + FRESH_MS),
        },
        update: {
          payload: reading as unknown as object,
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + FRESH_MS),
        },
      });

      recordSuccess();
      return reading;
    } catch (err) {
      recordFailure(err);
      if (attempt === 0) await sleep(400 + Math.random() * 200);
    }
  }

  return degrade(cached, age);
}

function degrade(cached: { payload: unknown } | null, age: number): WeatherReading {
  if (cached && age < STALE_MS) {
    return {
      ...(cached.payload as WeatherReading),
      status: "FORECAST_STALE",
      source: "STALE_CACHE",
    };
  }
  // La compra continúa, al precio base.
  return emptyReading("WEATHER_UNAVAILABLE");
}
```

**Matriz de degradación**

| Escenario | Acción | Precio | `status` |
|---|---|---|---|
| Caché < 30 min | Se sirve sin red | Con descuento si procede | `FORECAST_OK` |
| Timeout 2,5 s | 1 reintento con jitter | Con descuento si procede | `FORECAST_OK` |
| Proveedor caído, caché < 6 h | Se sirve la caché vencida | Con descuento si procede | `FORECAST_STALE` |
| Proveedor caído, sin caché | Se registra y se continúa | **Base, sin descuento** | `WEATHER_UNAVAILABLE` |
| 429 del proveedor | Cortocircuito 60 s | Base o caché vieja | `FORECAST_STALE` / `WEATHER_UNAVAILABLE` |
| Fecha fuera de ventana | Ni se consulta | Base, sin descuento | `FORECAST_OUT_OF_RANGE` |

Se degrada al **precio base**, no al de descuento: el descuento es una afirmación sobre el mundo ("va a llover") y sin datos no se puede afirmar. Regalar un 20 % ante cada fallo de red convertiría una caída del proveedor en un incentivo para provocarla.

---

## 6. Motor de precios

### src/lib/pricing/engine.ts

Función pura: sin `fetch`, sin base de datos, sin `Date.now()`. Es el único lugar del sistema donde se decide un monto, y por eso es el único que exige cobertura del 100 %.

```ts
import { env } from "@/lib/env";
import type { WeatherReading } from "@/lib/weather/open-meteo";

export const PRICING_RULE_VERSION = "rain-v1";
export const RAIN_THRESHOLD_PCT = env.RAIN_THRESHOLD_PCT;
export const WEATHER_DISCOUNT_BPS = env.WEATHER_DISCOUNT_BPS;
/** Mínimo cobrable por Stripe en USD. */
export const MIN_CHARGE_CENTS = 50;

export interface PriceBreakdown {
  basePriceCents: number;
  discountBps: number;
  discountCents: number;
  finalPriceCents: number;
  discountApplied: boolean;
  reason: "RAIN_ABOVE_THRESHOLD" | "RAIN_BELOW_THRESHOLD" | "NO_FORECAST";
  ruleVersion: string;
  thresholdPct: number;
}

export function priceBooking(args: {
  basePriceCents: number;
  reading: Pick<WeatherReading, "status" | "rainProbability">;
}): PriceBreakdown {
  const { basePriceCents, reading } = args;

  const usable =
    reading.status === "FORECAST_OK" || reading.status === "FORECAST_STALE";
  const rain = reading.rainProbability;

  // "Supera el 60 %" es estrictamente mayor: 60 exacto NO descuenta, 61 sí.
  const applied = usable && rain !== null && rain > RAIN_THRESHOLD_PCT;

  const discountBps = applied ? WEATHER_DISCOUNT_BPS : 0;
  const discountCents = Math.round((basePriceCents * discountBps) / 10_000);
  const finalPriceCents = Math.max(basePriceCents - discountCents, MIN_CHARGE_CENTS);

  return {
    basePriceCents,
    discountBps,
    discountCents,
    finalPriceCents,
    discountApplied: applied,
    reason:
      !usable || rain === null
        ? "NO_FORECAST"
        : applied
          ? "RAIN_ABOVE_THRESHOLD"
          : "RAIN_BELOW_THRESHOLD",
    ruleVersion: PRICING_RULE_VERSION,
    thresholdPct: RAIN_THRESHOLD_PCT,
  };
}
```

### src/lib/pricing/quote-token.ts

El token **no autoriza ningún precio**: el servidor recalcula siempre. Sirve para responder una sola pregunta —"¿lo que el usuario vio hace ocho minutos sigue vigente?"— sin guardar cotizaciones en la base de datos.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const TTL_MS = 10 * 60_000;

export type QuotePayload = {
  t: string; // tourId
  d: string; // bookingDate
  s: string; // timeSlot
  f: number; // finalPriceCents mostrado al usuario
  r: string; // ruleVersion
  x: number; // expiración, epoch ms
};

const encode = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) =>
  createHmac("sha256", env.QUOTE_SIGNING_SECRET).update(body).digest("base64url");

export function issueQuoteToken(p: Omit<QuotePayload, "x">): {
  quoteToken: string;
  quoteExpiresAt: string;
} {
  const payload: QuotePayload = { ...p, x: Date.now() + TTL_MS };
  const body = encode(JSON.stringify(payload));
  return {
    quoteToken: `v1.${body}.${sign(body)}`,
    quoteExpiresAt: new Date(payload.x).toISOString(),
  };
}

export function verifyQuoteToken(token: string): QuotePayload | null {
  const [version, body, mac] = token.split(".");
  if (version !== "v1" || !body || !mac) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  // Comparación en tiempo constante: evita filtrar el secreto por temporización.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as QuotePayload;
    return payload.x < Date.now() ? null : payload;
  } catch {
    return null;
  }
}
```

---

## 7. Stripe

### src/lib/stripe/client.ts

```ts
import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  appInfo: { name: "paseo-seguro", version: "1.0.0" },
  // La versión de API se fija en el panel de Stripe, en el destino de eventos,
  // para que la forma de los eventos no cambie al actualizar el SDK.
  // Si la quieres fijar también aquí, añade:
  //   apiVersion: "2025-08-27.basil"
  // usando exactamente la constante que soporte tu versión de `stripe`.
});
```

### src/lib/stripe/handle-event.ts

Las tres capas de idempotencia viven aquí. Cada una cubre un fallo distinto y ninguna sustituye a las otras.

```ts
import type Stripe from "stripe";
import { Prisma, type BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (!HANDLED.has(event.type)) return;

  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = session.metadata?.booking_id ?? session.client_reference_id;

  if (!bookingId) {
    console.warn("[stripe] evento sin booking_id:", event.id);
    return; // 200: no hay nada que reintentar
  }

  await prisma.$transaction(async (tx) => {
    // ── Capa 2 · candado de idempotencia de entrada ──────────────────
    // La clave primaria es el id del evento. Un duplicado revienta aquí,
    // antes de tocar la reserva, y salimos devolviendo 200.
    //
    // El patrón "if (await findEvent(id)) return; await createEvent(id)"
    // PARECE idempotente y no lo es: entre la lectura y la escritura caben
    // dos entregas simultáneas. La atomicidad tiene que estar en la base.
    try {
      await tx.processedWebhookEvent.create({
        data: { id: event.id, type: event.type, bookingId },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        console.info("[stripe] evento ya procesado:", event.id);
        return;
      }
      throw e;
    }

    const next = nextStatus(event.type, session.payment_status);
    if (!next) return; // p. ej. completed pero todavía "unpaid"

    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error(`reserva inexistente: ${bookingId}`);

    // Verificación de integridad: el importe cobrado debe ser el que calculamos.
    if (next === "CONFIRMED" && session.amount_total !== booking.finalPriceCents) {
      console.error("[ALERTA] descuadre de importe", {
        bookingId,
        esperado: booking.finalPriceCents,
        cobrado: session.amount_total,
      });
    }

    // ── Capa 3 · transición condicionada al estado actual ────────────
    // updateMany con status:"PENDING" en el WHERE: si otra entrega ya movió
    // la reserva, esto afecta 0 filas en lugar de reconfirmarla.
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: "PENDING" },
      data: {
        status: next,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        amountPaidCents: session.amount_total ?? null,
        confirmedAt: next === "CONFIRMED" ? new Date() : null,
      },
    });

    if (count === 0) console.info("[stripe] transición ya aplicada:", bookingId);
  });
}

function nextStatus(
  type: string,
  paymentStatus?: Stripe.Checkout.Session.PaymentStatus,
): BookingStatus | null {
  switch (type) {
    // Con métodos asíncronos (transferencias, OXXO) la sesión se completa
    // "unpaid": el dinero aún no llegó. Se espera al evento async_payment_*.
    case "checkout.session.completed":
      return paymentStatus === "paid" ? "CONFIRMED" : null;
    case "checkout.session.async_payment_succeeded":
      return "CONFIRMED";
    case "checkout.session.async_payment_failed":
      return "PAYMENT_FAILED";
    case "checkout.session.expired":
      return "EXPIRED";
    default:
      return null;
  }
}
```

**Las tres capas**

| Capa | Mecanismo | Qué fallo evita |
|---|---|---|
| 1 · Salida | `Idempotency-Key: booking:<id>` en `sessions.create` | Doble clic crea dos sesiones de pago para la misma reserva |
| 2 · Entrada | `ProcessedWebhookEvent.id` como clave primaria, dentro de la transacción | Stripe reenvía el mismo `event.id` (reintento, reenvío manual, entregas concurrentes) |
| 3 · Estado | `updateMany({ where: { id, status: "PENDING" } })` | Dos eventos *distintos* mueven la misma reserva y la confirman dos veces |

---

## 8. Rutas de API

### src/app/api/tours/route.ts

Devuelve el catálogo **sin clima**, a propósito: el descuento depende de una fecha que todavía no existe, y pedir el pronóstico de seis tours en cada carga de página agotaría la cuota gratuita en horas.

```ts
import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 50);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const tours = await prisma.tour.findMany({
      where: {
        active: true,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { locationName: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { title: "asc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        locationName: true,
        countryCode: true,
        latitude: true,
        longitude: true,
        timezone: true,
        basePriceCents: true,
        currency: true,
        durationMin: true,
        slots: true,
      },
    });

    const hasMore = tours.length > limit;
    const data = hasMore ? tours.slice(0, limit) : tours;

    return ok({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null });
  } catch (err) {
    console.error("[tours] ", err);
    return fail(500, "INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
  }
}
```

### src/app/api/tours/[idOrSlug]/route.ts

```ts
import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";
import { forecastWindow } from "@/lib/weather/window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
) {
  // En Next 15 los params de rutas dinámicas son una promesa.
  const { idOrSlug } = await params;

  const tour = await prisma.tour.findFirst({
    where: { active: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });

  if (!tour) return fail(404, "TOUR_NOT_FOUND", ERROR_MESSAGES.TOUR_NOT_FOUND);

  return ok({
    ...tour,
    // El frontend usa esto para acotar el selector de fechas.
    forecastWindow: forecastWindow(tour.timezone),
  });
}
```

### src/app/api/bookings/quote/route.ts

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getRainProbability } from "@/lib/weather/service";
import { checkBookingWindow } from "@/lib/weather/window";
import { priceBooking } from "@/lib/pricing/engine";
import { issueQuoteToken } from "@/lib/pricing/quote-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    tourId: z.string().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato esperado YYYY-MM-DD"),
    timeSlot: z.enum(["MORNING", "AFTERNOON", "EVENING"]),
  })
  .strict();

export async function POST(req: Request) {
  const limit = rateLimit(`quote:${clientIp(req)}`, 20);
  if (!limit.allowed) return fail(429, "RATE_LIMITED", ERROR_MESSAGES.RATE_LIMITED);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", ERROR_MESSAGES.VALIDATION_ERROR, parsed.error.flatten());
  }
  const input = parsed.data;

  const tour = await prisma.tour.findFirst({ where: { id: input.tourId, active: true } });
  if (!tour) return fail(404, "TOUR_NOT_FOUND", ERROR_MESSAGES.TOUR_NOT_FOUND);

  if (!tour.slots.includes(input.timeSlot)) {
    return fail(400, "SLOT_NOT_OFFERED", ERROR_MESSAGES.SLOT_NOT_OFFERED);
  }

  const win = checkBookingWindow(input.bookingDate, tour.timezone);
  if (!win.ok) return fail(400, win.code, ERROR_MESSAGES[win.code]);

  const reading = await getRainProbability(tour, input.bookingDate, input.timeSlot);
  const price = priceBooking({ basePriceCents: tour.basePriceCents, reading });

  const quote = issueQuoteToken({
    t: tour.id,
    d: input.bookingDate,
    s: input.timeSlot,
    f: price.finalPriceCents,
    r: price.ruleVersion,
  });

  return ok({
    tour: {
      id: tour.id,
      slug: tour.slug,
      title: tour.title,
      locationName: tour.locationName,
      timezone: tour.timezone,
    },
    bookingDate: input.bookingDate,
    timeSlot: input.timeSlot,
    weather: {
      status: reading.status,
      rainProbability: reading.rainProbability,
      source: reading.source,
      aggregation: reading.aggregation,
      observedAt: reading.fetchedAt,
    },
    price: { ...price, currency: tour.currency },
    ...quote,
  });
}
```

### src/app/api/bookings/checkout/route.ts

El corazón del sistema. El orden importa: validar → leer el tour → consultar clima → calcular → comparar con la cotización → persistir → cobrar. **El monto solo existe a partir del cuarto paso**, y siempre del lado del servidor.

```ts
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe/client";
import { getRainProbability } from "@/lib/weather/service";
import { checkBookingWindow } from "@/lib/weather/window";
import { priceBooking } from "@/lib/pricing/engine";
import { issueQuoteToken, verifyQuoteToken } from "@/lib/pricing/quote-token";
import { SLOT_LABEL } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// .strict() → un cuerpo con "price" o "finalPriceCents" es un 400, no un
// campo ignorado en silencio. Un campo de precio en la petición es un intento
// de manipulación y el sistema lo trata como tal.
const Body = z
  .object({
    tourId: z.string().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlot: z.enum(["MORNING", "AFTERNOON", "EVENING"]),
    customerName: z.string().trim().min(2).max(120),
    customerEmail: z.string().email().max(200),
    quoteToken: z.string().optional(),
  })
  .strict();

export async function POST(req: Request) {
  const limit = rateLimit(`checkout:${clientIp(req)}`, 5);
  if (!limit.allowed) return fail(429, "RATE_LIMITED", ERROR_MESSAGES.RATE_LIMITED);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const unrecognized = parsed.error.issues.some((i) => i.code === "unrecognized_keys");
    if (unrecognized) {
      console.warn("[seguridad] checkout con campos no esperados", {
        ip: clientIp(req),
        claves: Object.keys(json ?? {}),
      });
      return fail(400, "UNEXPECTED_FIELD", ERROR_MESSAGES.UNEXPECTED_FIELD, flat);
    }
    return fail(400, "VALIDATION_ERROR", ERROR_MESSAGES.VALIDATION_ERROR, flat);
  }
  const input = parsed.data;

  const tour = await prisma.tour.findFirst({ where: { id: input.tourId, active: true } });
  if (!tour) return fail(404, "TOUR_NOT_FOUND", ERROR_MESSAGES.TOUR_NOT_FOUND);

  if (!tour.slots.includes(input.timeSlot)) {
    return fail(400, "SLOT_NOT_OFFERED", ERROR_MESSAGES.SLOT_NOT_OFFERED);
  }

  const win = checkBookingWindow(input.bookingDate, tour.timezone);
  if (!win.ok) return fail(400, win.code, ERROR_MESSAGES[win.code]);

  // 1. Clima y precio recalculados desde cero, ignorando por completo
  //    cualquier cosa que el cliente pudiera haber enviado.
  const reading = await getRainProbability(tour, input.bookingDate, input.timeSlot);
  const price = priceBooking({ basePriceCents: tour.basePriceCents, reading });

  // 2. ¿Sigue vigente lo que el usuario vio al cotizar?
  if (input.quoteToken) {
    const quoted = verifyQuoteToken(input.quoteToken);
    if (!quoted) return fail(422, "QUOTE_EXPIRED", ERROR_MESSAGES.QUOTE_EXPIRED);

    if (quoted.f !== price.finalPriceCents) {
      // No es un error del usuario: es el sistema negándose a cobrar un
      // precio que ya no corresponde. Nunca se reintenta automáticamente.
      return Response.json(
        {
          error: { code: "PRICE_CHANGED", message: ERROR_MESSAGES.PRICE_CHANGED },
          quote: {
            weather: { status: reading.status, rainProbability: reading.rainProbability },
            price: { ...price, currency: tour.currency },
            ...issueQuoteToken({
              t: tour.id,
              d: input.bookingDate,
              s: input.timeSlot,
              f: price.finalPriceCents,
              r: price.ruleVersion,
            }),
          },
        },
        { status: 409 },
      );
    }
  }

  // 3. La reserva nace PENDING, con su evidencia adjunta.
  const booking = await prisma.booking.create({
    data: {
      tourId: tour.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail.toLowerCase(),
      bookingDate: new Date(`${input.bookingDate}T00:00:00Z`),
      timeSlot: input.timeSlot,
      basePriceCents: price.basePriceCents,
      discountBps: price.discountBps,
      discountCents: price.discountCents,
      finalPriceCents: price.finalPriceCents,
      currency: tour.currency,
      pricingRuleVersion: price.ruleVersion,
      weatherSnapshot: {
        ...reading,
        thresholdPct: price.thresholdPct,
        discountBps: price.discountBps,
      } as unknown as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });

  // 4. Recién ahora aparece un monto en una petición saliente.
  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        locale: "es",
        submit_type: "book",
        customer_email: booking.customerEmail,
        client_reference_id: booking.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: tour.currency.toLowerCase(), // ISO-4217 en minúsculas
              unit_amount: price.finalPriceCents,    // ← verificado en el servidor
              product_data: {
                name: tour.title,
                description: `${tour.locationName} · ${input.bookingDate} · ${SLOT_LABEL[input.timeSlot]}`,
              },
            },
          },
        ],
        // metadata: solo cadenas, máx. 50 claves y 500 caracteres por valor.
        metadata: {
          booking_id: booking.id,
          tour_id: tour.id,
          booking_date: input.bookingDate,
          time_slot: input.timeSlot,
          weather_discount_applied: String(price.discountApplied),
          rain_probability: String(reading.rainProbability ?? "unknown"),
          forecast_status: reading.status,
          pricing_rule_version: price.ruleVersion,
        },
        payment_intent_data: { metadata: { booking_id: booking.id } },
        success_url: `${env.APP_URL}/reservas/confirmacion?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.APP_URL}/tours/${tour.slug}?cancelado=1`,
        // Rango admitido por Stripe: entre 30 minutos y 24 horas.
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      {
        // Capa 1 de idempotencia: un doble clic reutiliza la misma sesión.
        idempotencyKey: `booking:${booking.id}`,
      },
    );
  } catch (err) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    console.error("[stripe] no se pudo crear la sesión", booking.id, err);
    return fail(502, "PAYMENT_PROVIDER_ERROR", ERROR_MESSAGES.PAYMENT_PROVIDER_ERROR);
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripeSessionId: session.id },
  });

  return ok(
    {
      bookingId: booking.id,
      status: "PENDING",
      checkoutUrl: session.url,
      sessionExpiresAt: new Date(session.expires_at * 1000).toISOString(),
      price: { ...price, currency: tour.currency },
    },
    201,
  );
}
```

### src/app/api/bookings/by-session/[sessionId]/route.ts

El `sessionId` de Stripe funciona como capacidad: es largo, aleatorio y solo lo conoce quien completó ese pago.

```ts
import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";
import { toDateString } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  if (!sessionId.startsWith("cs_")) {
    return fail(404, "BOOKING_NOT_FOUND", ERROR_MESSAGES.BOOKING_NOT_FOUND);
  }

  const booking = await prisma.booking.findUnique({
    where: { stripeSessionId: sessionId },
    include: { tour: { select: { title: true, slug: true, locationName: true } } },
  });

  if (!booking) return fail(404, "BOOKING_NOT_FOUND", ERROR_MESSAGES.BOOKING_NOT_FOUND);

  const snapshot = booking.weatherSnapshot as { rainProbability?: number | null } | null;

  return ok({
    bookingId: booking.id,
    status: booking.status,
    confirmedAt: booking.confirmedAt,
    customerName: booking.customerName,
    tour: booking.tour,
    bookingDate: toDateString(booking.bookingDate),
    timeSlot: booking.timeSlot,
    price: {
      basePriceCents: booking.basePriceCents,
      discountCents: booking.discountCents,
      finalPriceCents: booking.finalPriceCents,
      currency: booking.currency,
      discountApplied: booking.discountBps > 0,
    },
    weather: { rainProbability: snapshot?.rainProbability ?? null },
  });
}
```

### src/app/api/webhooks/stripe/route.ts

Tres reglas gobiernan este archivo: el cuerpo se lee crudo, la firma se verifica antes de mirar nada del contenido, y el cambio de estado ocurre dentro de una transacción.

```ts
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/lib/stripe/handle-event";

export const runtime = "nodejs"; // no "edge": constructEvent usa el crypto de Node
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // req.text() entrega el cuerpo EXACTO. No usar req.json(): reserializar
  // cambia los bytes y la firma deja de coincidir.
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
    // 4.º argumento opcional: tolerancia en segundos, 300 por defecto.
    // Nunca poner 0: desactiva la protección contra reenvíos.
  } catch (err) {
    console.warn("[stripe] firma inválida:", (err as Error).message);
    return new Response("Invalid signature", { status: 400 }); // 400, no 500
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error("[stripe] fallo procesando", event.id, err);
    // 500 a propósito: el reintento de Stripe es la red de seguridad.
    // Un 200 aquí le diría "ya está resuelto" y perderíamos el evento.
    return new Response("Retry later", { status: 500 });
  }

  return Response.json({ received: true });
}
```

> **Si tu backend fuera Express**, el cuerpo crudo hay que pedirlo explícitamente y el orden de los middlewares importa:
>
> ```ts
> app.post(
>   "/api/webhooks/stripe",
>   express.raw({ type: "application/json" }),   // Buffer, no objeto
>   handler,
> );
> app.use(express.json());                        // ← después, nunca antes
> ```

---

## 9. Frontend

Las páginas son componentes de servidor y leen de Prisma directamente: es lo idiomático en App Router y ahorra un viaje de red. La API REST sigue existiendo para lo que sí ocurre en el navegador —cotizar, pagar y consultar el estado— y para cualquier cliente externo.

### src/app/layout.tsx

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paseo Seguro",
  description:
    "Reserva tours en República Dominicana con descuento automático cuando el pronóstico anuncia lluvia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            <span className="brand-dot" aria-hidden="true" />
            Paseo Seguro
          </a>
          <p className="tagline">Si el pronóstico anuncia lluvia, el precio baja solo.</p>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <span>Pronóstico por Open-Meteo · Pagos por Stripe (modo prueba)</span>
        </footer>
      </body>
    </html>
  );
}
```

### src/app/globals.css

```css
:root {
  --bg: #eef2f3;
  --surface: #ffffff;
  --surface-2: #f5f8f9;
  --line: #d3dde1;
  --ink: #0f1a20;
  --ink-2: #3d4e57;
  --ink-3: #697c85;
  --accent: #0d5a73;
  --accent-soft: #dceaf0;
  --ok: #1c7554;
  --ok-soft: #dcefe5;
  --warn: #8a5a0b;
  --warn-soft: #f5ead3;
  --danger: #a93a2c;
  --danger-soft: #f6e1dd;
  --radius: 10px;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, monospace;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }

.site-header {
  max-width: 1080px;
  margin: 0 auto;
  padding: 28px 24px 20px;
  display: flex;
  align-items: baseline;
  gap: 18px;
  flex-wrap: wrap;
}
.brand {
  display: flex; align-items: center; gap: 9px;
  font-size: 1.15rem; font-weight: 650; color: var(--ink); text-decoration: none;
}
.brand-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); }
.tagline { margin: 0; color: var(--ink-3); font-size: .92rem; }

.site-main { max-width: 1080px; margin: 0 auto; padding: 12px 24px 72px; }
.site-footer {
  max-width: 1080px; margin: 0 auto; padding: 24px;
  border-top: 1px solid var(--line); color: var(--ink-3); font-size: .82rem;
}

h1 { font-size: 1.9rem; letter-spacing: -.02em; margin: 12px 0 6px; }
h2 { font-size: 1.15rem; margin: 0 0 10px; }
.muted { color: var(--ink-3); }

/* ── catálogo ─────────────────────────────────────────────── */
.tour-grid {
  display: grid; gap: 18px; margin-top: 26px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
.tour-card {
  display: flex; flex-direction: column; gap: 10px;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 20px; text-decoration: none; color: inherit;
}
.tour-card:hover { border-color: var(--accent); }
.tour-card h3 { margin: 0; font-size: 1.05rem; }
.tour-card .loc { color: var(--ink-3); font-size: .88rem; margin: 0; }
.tour-card .desc { color: var(--ink-2); font-size: .9rem; margin: 0; flex: 1; }
.tour-card .foot {
  display: flex; justify-content: space-between; align-items: baseline;
  border-top: 1px solid var(--line); padding-top: 12px; margin-top: 4px;
}
.price { font-size: 1.15rem; font-weight: 650; font-variant-numeric: tabular-nums; }

/* ── detalle ──────────────────────────────────────────────── */
.detail { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); gap: 32px; }
@media (max-width: 860px) { .detail { grid-template-columns: 1fr; } }
.detail .body p { color: var(--ink-2); max-width: 62ch; }
.facts { display: grid; gap: 0 28px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-top: 24px; }
.facts div { border-top: 1px solid var(--line); padding: 12px 0; }
.facts dt { font-size: .7rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-3); font-family: var(--mono); }
.facts dd { margin: 4px 0 0; font-size: .95rem; }

/* ── panel de reserva ─────────────────────────────────────── */
.panel {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 22px; position: sticky; top: 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: .78rem; font-weight: 600; color: var(--ink-2); }
.field input, .field select {
  font: inherit; font-size: .95rem; padding: 9px 11px;
  border: 1px solid var(--line); border-radius: 7px;
  background: var(--surface-2); color: var(--ink);
}
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.weather {
  border-radius: 8px; padding: 14px 16px; background: var(--surface-2);
  border: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px;
}
.weather.discount { background: var(--ok-soft); border-color: transparent; }
.weather.unknown { background: var(--warn-soft); border-color: transparent; }
.weather .headline { font-weight: 600; font-size: .95rem; }
.weather .detail-line { font-size: .84rem; color: var(--ink-2); }
.rainbar { height: 6px; border-radius: 3px; background: #cfdde3; overflow: hidden; }
.rainbar span { display: block; height: 100%; background: var(--accent); }

.total { display: flex; flex-direction: column; gap: 2px; border-top: 1px solid var(--line); padding-top: 14px; }
.total .strike { color: var(--ink-3); text-decoration: line-through; font-size: .9rem; }
.total .final { font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.total .save { color: var(--ok); font-size: .86rem; font-weight: 600; }

button.cta {
  font: inherit; font-weight: 600; font-size: .98rem; padding: 12px 16px;
  border: none; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer;
}
button.cta:hover:not(:disabled) { background: #0a4a5f; }
button.cta:disabled { opacity: .5; cursor: not-allowed; }

.alert { border-radius: 8px; padding: 12px 14px; font-size: .88rem; }
.alert.error { background: var(--danger-soft); color: var(--danger); }
.alert.info { background: var(--accent-soft); color: var(--accent); }
.alert.warn { background: var(--warn-soft); color: var(--warn); }

.badge {
  display: inline-block; font-family: var(--mono); font-size: .7rem; letter-spacing: .05em;
  padding: .2em .55em; border-radius: 4px; background: var(--accent-soft); color: var(--accent);
}
.badge.ok { background: var(--ok-soft); color: var(--ok); }
.badge.warn { background: var(--warn-soft); color: var(--warn); }
.badge.danger { background: var(--danger-soft); color: var(--danger); }

/* ── confirmación ─────────────────────────────────────────── */
.confirm { max-width: 560px; margin: 40px auto; background: var(--surface);
  border: 1px solid var(--line); border-radius: var(--radius); padding: 32px; }
.confirm h1 { margin-top: 0; }
.confirm .summary { border-top: 1px solid var(--line); margin-top: 22px; padding-top: 18px;
  display: grid; gap: 10px; }
.confirm .summary div { display: flex; justify-content: space-between; gap: 16px; font-size: .93rem; }
.confirm .summary dt { color: var(--ink-3); }
.spinner {
  width: 18px; height: 18px; border: 2px solid var(--line); border-top-color: var(--accent);
  border-radius: 50%; animation: spin .8s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
```

### src/app/page.tsx

El catálogo.

```tsx
import { prisma } from "@/lib/db";
import { formatMoney, SLOT_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const tours = await prisma.tour.findMany({
    where: { active: true },
    orderBy: { basePriceCents: "asc" },
  });

  return (
    <>
      <h1>Tours en República Dominicana</h1>
      <p className="muted">
        Elige una fecha dentro de los próximos 14 días y consultaremos el pronóstico del
        destino. Si la probabilidad de lluvia supera el 60 %, el descuento se aplica solo.
      </p>

      <div className="tour-grid">
        {tours.map((tour) => (
          <a key={tour.id} className="tour-card" href={`/tours/${tour.slug}`}>
            <h3>{tour.title}</h3>
            <p className="loc">{tour.locationName}</p>
            <p className="desc">{tour.description}</p>
            <div className="foot">
              <span className="price">{formatMoney(tour.basePriceCents, tour.currency)}</span>
              <span className="muted" style={{ fontSize: ".82rem" }}>
                {tour.slots.map((s) => SLOT_LABEL[s]).join(" · ")}
              </span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
```

### src/app/tours/[slug]/page.tsx

La página de detalle, con el panel de reserva a la derecha.

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, SLOT_LABEL, SLOT_RANGE } from "@/lib/format";
import { forecastWindow, FORECAST_MAX_DAYS } from "@/lib/weather/window";
import { BookingPanel } from "@/components/BookingPanel";

export const dynamic = "force-dynamic";

export default async function TourPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tour = await prisma.tour.findFirst({ where: { slug, active: true } });
  if (!tour) notFound();

  const window = forecastWindow(tour.timezone);

  return (
    <div className="detail">
      <div className="body">
        <h1>{tour.title}</h1>
        <p className="muted">{tour.locationName}</p>
        <p>{tour.description}</p>

        <dl className="facts">
          <div>
            <dt>Duración</dt>
            <dd>
              {tour.durationMin >= 1440
                ? `${Math.round(tour.durationMin / 1440)} días`
                : `${Math.round(tour.durationMin / 60)} horas`}
            </dd>
          </div>
          <div>
            <dt>Franjas</dt>
            <dd>{tour.slots.map((s) => SLOT_LABEL[s]).join(" · ")}</dd>
          </div>
          <div>
            <dt>Horario</dt>
            <dd>{tour.slots.map((s) => SLOT_RANGE[s]).join(" / ")}</dd>
          </div>
          <div>
            <dt>Precio base</dt>
            <dd>{formatMoney(tour.basePriceCents, tour.currency)}</dd>
          </div>
          <div>
            <dt>Zona horaria</dt>
            <dd style={{ fontSize: ".85rem" }}>{tour.timezone}</dd>
          </div>
          <div>
            <dt>Ventana de pronóstico</dt>
            <dd>{FORECAST_MAX_DAYS} días</dd>
          </div>
        </dl>
      </div>

      <BookingPanel
        tourId={tour.id}
        slots={tour.slots}
        currency={tour.currency}
        basePriceCents={tour.basePriceCents}
        minDate={window.minDate}
        maxDate={window.maxDate}
        maxForecastDate={window.maxForecastDate}
      />
    </div>
  );
}
```

### src/components/WeatherBadge.tsx

```tsx
import type { Quote } from "@/components/BookingPanel";

const COPY: Record<string, { className: string; headline: (p: number | null) => string; detail: string }> = {
  FORECAST_OK: {
    className: "weather",
    headline: (p) => `${p} % de probabilidad de lluvia`,
    detail: "Pronóstico en vivo para la franja seleccionada.",
  },
  FORECAST_STALE: {
    className: "weather",
    headline: (p) => `${p} % de probabilidad de lluvia`,
    detail: "Pronóstico guardado hace poco; el proveedor no responde ahora mismo.",
  },
  FORECAST_OUT_OF_RANGE: {
    className: "weather unknown",
    headline: () => "Fuera de la ventana de pronóstico",
    detail: "El descuento por lluvia se evalúa 14 días antes del tour.",
  },
  WEATHER_UNAVAILABLE: {
    className: "weather unknown",
    headline: () => "No pudimos consultar el pronóstico",
    detail: "El precio mostrado es el base. Puedes reservar igualmente.",
  },
};

export function WeatherBadge({ quote }: { quote: Quote }) {
  const copy = COPY[quote.weather.status] ?? COPY.WEATHER_UNAVAILABLE;
  const rain = quote.weather.rainProbability;
  const discounted = quote.price.discountApplied;

  return (
    <div className={discounted ? "weather discount" : copy.className}>
      <span className="headline">{copy.headline(rain)}</span>
      {rain !== null && (
        <div className="rainbar" role="img" aria-label={`${rain} por ciento de lluvia`}>
          <span style={{ width: `${rain}%` }} />
        </div>
      )}
      <span className="detail-line">
        {discounted
          ? `Supera el ${quote.price.thresholdPct} %: descuento del ${quote.price.discountBps / 100} % aplicado.`
          : copy.detail}
      </span>
    </div>
  );
}
```

### src/components/BookingPanel.tsx

El componente de cliente. Lo importante está en `handleCheckout`: el cuerpo que sale del navegador tiene **cinco campos y ninguno es un precio**.

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney, SLOT_LABEL } from "@/lib/format";
import { WeatherBadge } from "@/components/WeatherBadge";

type Slot = "MORNING" | "AFTERNOON" | "EVENING";

export type Quote = {
  bookingDate: string;
  timeSlot: Slot;
  weather: {
    status: string;
    rainProbability: number | null;
    source: string;
    observedAt: string;
  };
  price: {
    basePriceCents: number;
    discountBps: number;
    discountCents: number;
    finalPriceCents: number;
    currency: string;
    discountApplied: boolean;
    thresholdPct: number;
  };
  quoteToken: string;
  quoteExpiresAt: string;
};

export function BookingPanel(props: {
  tourId: string;
  slots: Slot[];
  currency: string;
  basePriceCents: number;
  minDate: string;
  maxDate: string;
  maxForecastDate: string;
}) {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<Slot>(props.slots[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Solo identificadores. Ningún precio sale de aquí.
        body: JSON.stringify({ tourId: props.tourId, bookingDate: date, timeSlot: slot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "No pudimos cotizar.");
      setQuote(data);
    } catch (e) {
      setQuote(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date, slot, props.tourId]);

  useEffect(() => {
    setNotice(null);
    const t = setTimeout(fetchQuote, 250); // pequeño respiro al escribir la fecha
    return () => clearTimeout(t);
  }, [fetchQuote]);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tourId: props.tourId,
          bookingDate: date,
          timeSlot: slot,
          customerName: name,
          customerEmail: email,
          quoteToken: quote?.quoteToken,
        }),
      });

      const data = await res.json();

      // El pronóstico cambió entre cotizar y pagar: mostramos el precio nuevo
      // y pedimos confirmación explícita. Nunca se reintenta solo.
      if (res.status === 409) {
        setQuote({ ...(quote as Quote), ...data.quote });
        setNotice("El pronóstico cambió y con él el precio. Revísalo y confirma de nuevo.");
        return;
      }

      if (!res.ok) throw new Error(data?.error?.message ?? "No pudimos iniciar el pago.");

      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const price = quote?.price;
  const outOfForecast = Boolean(date) && date > props.maxForecastDate;
  const ready = Boolean(date && name.trim().length >= 2 && email.includes("@") && quote);

  return (
    <form className="panel" onSubmit={handleCheckout}>
      <h2>Reserva tu fecha</h2>

      <div className="row">
        <div className="field">
          <label htmlFor="date">Fecha</label>
          <input
            id="date"
            type="date"
            value={date}
            min={props.minDate}
            max={props.maxDate}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="slot">Franja</label>
          <select
            id="slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value as Slot)}
          >
            {props.slots.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {outOfForecast && (
        <div className="alert warn">
          Esa fecha está más allá de los 14 días de pronóstico. Puedes reservar al precio
          base; el descuento por lluvia no aplica todavía.
        </div>
      )}

      {loading && (
        <div className="alert info">
          <span className="spinner" aria-hidden="true" /> Consultando el pronóstico…
        </div>
      )}

      {quote && !loading && <WeatherBadge quote={quote} />}

      <div className="total">
        {price?.discountApplied && (
          <span className="strike">
            {formatMoney(price.basePriceCents, price.currency)}
          </span>
        )}
        <span className="final">
          {formatMoney(price?.finalPriceCents ?? props.basePriceCents, props.currency)}
        </span>
        {price?.discountApplied && (
          <span className="save">
            Ahorras {formatMoney(price.discountCents, price.currency)} por lluvia prevista
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="name">Nombre completo</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Joel Santos"
          required
          minLength={2}
        />
      </div>

      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          required
        />
      </div>

      {notice && <div className="alert warn">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <button className="cta" type="submit" disabled={!ready || submitting}>
        {submitting ? "Redirigiendo a Stripe…" : "Pagar y reservar"}
      </button>

      <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
        El precio lo calcula nuestro servidor con el pronóstico del destino. El pago se
        procesa en Stripe; nunca vemos tu tarjeta.
      </p>
    </form>
  );
}
```

### src/app/reservas/confirmacion/page.tsx

```tsx
import { Suspense } from "react";
import { ConfirmationView } from "@/components/ConfirmationView";

export const dynamic = "force-dynamic";

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <div className="confirm">
        <h1>Falta la referencia del pago</h1>
        <p className="muted">
          Llegaste aquí sin identificador de sesión. Si acabas de pagar, revisa tu correo:
          Stripe te envió el recibo. <a href="/">Volver al catálogo</a>
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="confirm">Cargando…</div>}>
      <ConfirmationView sessionId={sessionId} />
    </Suspense>
  );
}
```

### src/components/ConfirmationView.tsx

La redirección **no** se toma como prueba de pago: los pasos "el usuario vuelve" y "llega el webhook" corren en paralelo y sin orden garantizado. Esta vista sondea el estado real.

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatDate, SLOT_LABEL } from "@/lib/format";

type Booking = {
  bookingId: string;
  status: "PENDING" | "CONFIRMED" | "PAYMENT_FAILED" | "EXPIRED" | "CANCELLED";
  confirmedAt: string | null;
  customerName: string;
  tour: { title: string; slug: string; locationName: string };
  bookingDate: string;
  timeSlot: "MORNING" | "AFTERNOON" | "EVENING";
  price: {
    basePriceCents: number;
    discountCents: number;
    finalPriceCents: number;
    currency: string;
    discountApplied: boolean;
  };
  weather: { rainProbability: number | null };
};

const POLL_MS = 1500;
const TIMEOUT_MS = 30_000;

export function ConfirmationView({ sessionId }: { sessionId: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/bookings/by-session/${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          // Puede que el webhook aún no haya asociado la sesión: seguimos.
          if (Date.now() - startedAt < TIMEOUT_MS) return void setTimeout(poll, POLL_MS);
          setError(data?.error?.message ?? "No encontramos esa reserva.");
          return;
        }

        if (cancelled) return;
        setBooking(data);

        if (data.status === "PENDING") {
          if (Date.now() - startedAt < TIMEOUT_MS) setTimeout(poll, POLL_MS);
          else setTimedOut(true);
        }
      } catch {
        if (Date.now() - startedAt < TIMEOUT_MS) setTimeout(poll, POLL_MS);
        else setTimedOut(true);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="confirm">
        <h1>No encontramos tu reserva</h1>
        <p className="muted">{error}</p>
        <p><a href="/">Volver al catálogo</a></p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="confirm">
        <h1><span className="spinner" aria-hidden="true" /> Confirmando tu pago…</h1>
        <p className="muted">Esto suele tardar un par de segundos.</p>
      </div>
    );
  }

  const isConfirmed = booking.status === "CONFIRMED";
  const isPending = booking.status === "PENDING";

  return (
    <div className="confirm">
      <span className={`badge ${isConfirmed ? "ok" : isPending ? "warn" : "danger"}`}>
        {booking.status}
      </span>

      <h1 style={{ marginTop: 14 }}>
        {isConfirmed
          ? `Listo, ${booking.customerName.split(" ")[0]}`
          : isPending
            ? "Estamos confirmando tu pago"
            : "El pago no se completó"}
      </h1>

      <p className="muted">
        {isConfirmed
          ? "Tu reserva quedó confirmada. Te enviamos el detalle por correo."
          : isPending && timedOut
            ? "Tu banco todavía no confirma la operación. No cierres esta página; si tarda más de unos minutos, escríbenos con el número de reserva."
            : isPending
              ? "Un momento, estamos verificando con la pasarela de pago."
              : "No se realizó ningún cobro. Puedes intentarlo de nuevo desde la página del tour."}
      </p>

      <dl className="summary">
        <div><dt>Reserva</dt><dd style={{ fontFamily: "var(--mono)", fontSize: ".85rem" }}>{booking.bookingId}</dd></div>
        <div><dt>Tour</dt><dd>{booking.tour.title}</dd></div>
        <div><dt>Destino</dt><dd>{booking.tour.locationName}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(booking.bookingDate)}</dd></div>
        <div><dt>Franja</dt><dd>{SLOT_LABEL[booking.timeSlot]}</dd></div>
        {booking.weather.rainProbability !== null && (
          <div><dt>Lluvia prevista</dt><dd>{booking.weather.rainProbability}&nbsp;%</dd></div>
        )}
        {booking.price.discountApplied && (
          <div>
            <dt>Descuento por lluvia</dt>
            <dd style={{ color: "var(--ok)" }}>
              −{formatMoney(booking.price.discountCents, booking.price.currency)}
            </dd>
          </div>
        )}
        <div>
          <dt>Total</dt>
          <dd style={{ fontWeight: 700 }}>
            {formatMoney(booking.price.finalPriceCents, booking.price.currency)}
          </dd>
        </div>
      </dl>

      <p style={{ marginTop: 26 }}>
        <a href={`/tours/${booking.tour.slug}`}>Volver al tour</a> ·{" "}
        <a href="/">Ver todos los tours</a>
      </p>
    </div>
  );
}
```

---

## 10. Pruebas

### src/lib/pricing/engine.test.ts

Las dos filas que más valen son `60` y `61`: fijan que "supera el 60 %" significa estrictamente mayor.

```ts
import { describe, it, expect } from "vitest";
import { priceBooking } from "./engine";
import type { WeatherReading } from "@/lib/weather/open-meteo";

const reading = (
  rainProbability: number | null,
  status: WeatherReading["status"] = "FORECAST_OK",
) => ({ status, rainProbability });

describe("priceBooking", () => {
  it.each([
    // caso                        base   lluvia  final  descuento
    ["día despejado",              8900,  12,     8900,  false],
    ["justo en el umbral",         8900,  60,     8900,  false], // ← estrictamente mayor
    ["un punto por encima",        8900,  61,     7120,  true],
    ["lluvia segura",              8900,  100,    7120,  true],
    ["redondeo con precio impar",  4999,  74,     3999,  true],  // 999,8 → 1000
    ["sin dato de lluvia",         8900,  null,   8900,  false],
  ])("%s", (_caso, base, rain, esperado, conDescuento) => {
    const r = priceBooking({ basePriceCents: base, reading: reading(rain) });

    expect(r.finalPriceCents).toBe(esperado);
    expect(r.discountApplied).toBe(conDescuento);
    expect(Number.isInteger(r.finalPriceCents)).toBe(true);
    expect(r.basePriceCents - r.discountCents).toBe(r.finalPriceCents);
  });

  it("no descuenta si el pronóstico no es utilizable, aunque el número sea alto", () => {
    for (const status of ["FORECAST_OUT_OF_RANGE", "WEATHER_UNAVAILABLE"] as const) {
      const r = priceBooking({ basePriceCents: 8900, reading: reading(95, status) });
      expect(r.finalPriceCents).toBe(8900);
      expect(r.reason).toBe("NO_FORECAST");
    }
  });

  it("acepta la caché vencida como base para descontar", () => {
    const r = priceBooking({ basePriceCents: 8900, reading: reading(80, "FORECAST_STALE") });
    expect(r.discountApplied).toBe(true);
  });

  it("nunca baja del mínimo cobrable de Stripe", () => {
    const r = priceBooking({ basePriceCents: 60, reading: reading(90) });
    expect(r.finalPriceCents).toBeGreaterThanOrEqual(50);
  });
});
```

### src/lib/weather/open-meteo.test.ts

```ts
import { describe, it, expect } from "vitest";
import { extractSlotProbability, type ForecastResponse } from "./open-meteo";

const DATE = "2026-09-12";

function hourly(values: Record<number, number | null>): ForecastResponse {
  const time: string[] = [];
  const precipitation_probability: (number | null)[] = [];
  for (let h = 0; h < 24; h++) {
    time.push(`${DATE}T${String(h).padStart(2, "0")}:00`);
    precipitation_probability.push(values[h] ?? 0);
  }
  return { timezone: "America/Santo_Domingo", hourly: { time, precipitation_probability } };
}

describe("extractSlotProbability", () => {
  it("toma el máximo de la franja, no el promedio", () => {
    // Si llueve fuerte 2 de las 6 horas del tour, el tour se moja.
    const data = hourly({ 12: 10, 13: 10, 14: 90, 15: 88, 16: 10, 17: 10 });
    const r = extractSlotProbability(data, DATE, "AFTERNOON");

    expect(r.value).toBe(90);
    expect(r.aggregation).toBe("max");
    expect(r.used).toHaveLength(6);
  });

  it("ignora las horas fuera de la franja", () => {
    const data = hourly({ 5: 100, 6: 20, 7: 25, 23: 100 });
    expect(extractSlotProbability(data, DATE, "MORNING").value).toBe(25);
  });

  it("cae al máximo diario si no hay horas utilizables", () => {
    const data: ForecastResponse = {
      timezone: "America/Santo_Domingo",
      daily: { time: [DATE], precipitation_probability_max: [77] },
    };
    const r = extractSlotProbability(data, DATE, "AFTERNOON");

    expect(r.value).toBe(77);
    expect(r.aggregation).toBe("daily_max");
  });

  it("devuelve null cuando no hay ningún dato", () => {
    const r = extractSlotProbability({ timezone: "UTC" }, DATE, "EVENING");
    expect(r.value).toBeNull();
    expect(r.aggregation).toBeNull();
  });

  it("descarta los nulos del array horario", () => {
    const data = hourly({ 6: null, 7: null, 8: 42, 9: null, 10: null, 11: null });
    expect(extractSlotProbability(data, DATE, "MORNING").value).toBe(42);
  });
});
```

### src/lib/weather/window.test.ts

```ts
import { describe, it, expect } from "vitest";
import { todayInTimezone, daysAhead, checkBookingWindow } from "./window";

// 2026-09-12 a las 01:30 UTC = 2026-09-11 a las 21:30 en Santo Domingo (UTC−4).
const MEDIANOCHE_UTC = new Date("2026-09-12T01:30:00Z");

describe("ventana de reserva", () => {
  it("usa el calendario del destino, no el del servidor", () => {
    expect(todayInTimezone("America/Santo_Domingo", MEDIANOCHE_UTC)).toBe("2026-09-11");
    expect(todayInTimezone("UTC", MEDIANOCHE_UTC)).toBe("2026-09-12");
  });

  it("cuenta los días desde el hoy local", () => {
    expect(daysAhead("2026-09-11", "America/Santo_Domingo", MEDIANOCHE_UTC)).toBe(0);
    expect(daysAhead("2026-09-18", "America/Santo_Domingo", MEDIANOCHE_UTC)).toBe(7);
  });

  it("rechaza el pasado y acepta hoy", () => {
    const ayer = checkBookingWindow("2026-09-10", "America/Santo_Domingo", MEDIANOCHE_UTC);
    expect(ayer).toEqual({ ok: false, code: "DATE_IN_PAST" });

    const hoy = checkBookingWindow("2026-09-11", "America/Santo_Domingo", MEDIANOCHE_UTC);
    expect(hoy.ok && hoy.withinForecast).toBe(true);
  });

  it("permite reservar fuera de la ventana, pero sin pronóstico", () => {
    const r = checkBookingWindow("2026-10-15", "America/Santo_Domingo", MEDIANOCHE_UTC);
    expect(r.ok && r.withinForecast).toBe(false); // → precio base, sin descuento
  });

  it("rechaza más allá de un año", () => {
    const r = checkBookingWindow("2028-01-01", "America/Santo_Domingo", MEDIANOCHE_UTC);
    expect(r).toEqual({ ok: false, code: "DATE_TOO_FAR" });
  });
});
```

### src/app/api/webhooks/stripe/route.test.ts

Stripe expone un ayudante para firmar cargas de prueba, así que la verificación real se ejerce sin salir a la red. Esta prueba necesita la base de datos levantada.

```ts
import { describe, it, expect, beforeEach } from "vitest";
import Stripe from "stripe";
import { POST } from "./route";
import { prisma } from "@/lib/db";

const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
let bookingId: string;

function evento(id = "evt_test_1") {
  return {
    id,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        payment_status: "paid",
        amount_total: 7120,
        payment_intent: "pi_test_123",
        client_reference_id: bookingId,
        metadata: { booking_id: bookingId },
      },
    },
  };
}

function peticionFirmada(cuerpo: object, secret = SECRET) {
  const payload = JSON.stringify(cuerpo);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": header, "content-type": "application/json" },
  });
}

beforeEach(async () => {
  await prisma.processedWebhookEvent.deleteMany();
  await prisma.booking.deleteMany();

  const tour = await prisma.tour.findFirstOrThrow();
  const booking = await prisma.booking.create({
    data: {
      tourId: tour.id,
      customerName: "Prueba",
      customerEmail: "prueba@ejemplo.com",
      bookingDate: new Date("2026-09-12T00:00:00Z"),
      timeSlot: "AFTERNOON",
      basePriceCents: 8900,
      discountBps: 2000,
      discountCents: 1780,
      finalPriceCents: 7120,
      currency: "USD",
      pricingRuleVersion: "rain-v1",
      weatherSnapshot: { rainProbability: 74 },
      status: "PENDING",
      stripeSessionId: "cs_test_123",
    },
  });
  bookingId = booking.id;
});

describe("webhook de Stripe", () => {
  it("rechaza una firma que no corresponde y no toca la reserva", async () => {
    const res = await POST(peticionFirmada(evento(), "whsec_secreto_incorrecto"));

    expect(res.status).toBe(400);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe("PENDING");
  });

  it("rechaza un cuerpo alterado después de firmar", async () => {
    const payload = JSON.stringify(evento());
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const alterado = payload.replace('"amount_total":7120', '"amount_total":1');

    const res = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: alterado,
        headers: { "stripe-signature": header },
      }),
    );

    expect(res.status).toBe(400);
  });

  it("confirma la reserva y guarda el payment_intent", async () => {
    const res = await POST(peticionFirmada(evento()));

    expect(res.status).toBe(200);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe("CONFIRMED");
    expect(b.stripePaymentIntentId).toBe("pi_test_123");
    expect(b.confirmedAt).not.toBeNull();
  });

  it("confirma UNA sola vez ante entregas duplicadas", async () => {
    expect((await POST(peticionFirmada(evento()))).status).toBe(200);
    const primera = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    expect((await POST(peticionFirmada(evento()))).status).toBe(200); // mismo event.id
    const segunda = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    expect(segunda.confirmedAt).toEqual(primera.confirmedAt); // no se reconfirmó
    expect(await prisma.processedWebhookEvent.count()).toBe(1);
  });

  it("deja la reserva en PENDING si el pago es asíncrono y aún no llegó", async () => {
    const e = evento("evt_test_async");
    e.data.object.payment_status = "unpaid";

    expect((await POST(peticionFirmada(e))).status).toBe(200);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe("PENDING");
  });
});
```

---

## 11. Puesta en marcha

### Paso a paso

```bash
# 1. Crear el proyecto y entrar en la carpeta
mkdir paseo-seguro && cd paseo-seguro

# 2. Copiar todos los archivos de este documento en su ruta correspondiente,
#    luego instalar dependencias
npm install

# 3. Levantar PostgreSQL
npm run db:up

# 4. Configurar el entorno
#    Windows PowerShell:
copy .env.example .env.local
#    macOS / Linux:
#    cp .env.example .env.local
#
#    Edita .env.local y rellena:
#      STRIPE_SECRET_KEY      → dashboard.stripe.com/test/apikeys
#      QUOTE_SIGNING_SECRET   → cualquier cadena larga y aleatoria
#      STRIPE_WEBHOOK_SECRET  → lo obtienes en el paso 7

# 5. Crear el esquema en la base de datos
npx prisma migrate dev --name init

# 6. Sembrar el catálogo (resuelve coordenadas contra la API de geocodificación)
npm run db:seed
```

Deberías ver:

```
  ✓ Isla Saona en catamarán       18.3766, -68.8419  America/Santo_Domingo
  ✓ Bahía de las Águilas          18.0380, -71.7440  America/Santo_Domingo
  ...
6 tours sembrados con coordenadas resueltas por la API.
```

```bash
# 7. En una SEGUNDA terminal, redirigir los eventos de Stripe al servidor local.
#    Imprime un whsec_… que va en STRIPE_WEBHOOK_SECRET de tu .env.local.
#    Es distinto del secreto que aparece en el panel.
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 8. En la primera terminal, arrancar la app
npm run dev
```

Abre `http://localhost:3000`.

> **Windows:** ejecuta los comandos en PowerShell con Docker Desktop abierto. Si `stripe` no se reconoce, instálalo con `scoop install stripe` o descarga el binario desde la web de Stripe y añádelo al PATH.

### Prueba del ciclo completo

1. Abre un tour y elige una fecha dentro de los próximos 14 días.
2. Verás la probabilidad de lluvia y, si supera el 60 %, el precio tachado con el descuento.
3. Rellena nombre y correo, pulsa **Pagar y reservar**.
4. En Stripe, usa la tarjeta `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.
5. Vuelves a la página de confirmación; en la terminal de `stripe listen` verás llegar `checkout.session.completed` y la reserva pasará a `CONFIRMED`.

### Comandos útiles de la CLI de Stripe

```bash
# Disparar un evento sin pasar por la interfaz de pago
stripe trigger checkout.session.completed

# Reenviar un evento ya entregado: la prueba de idempotencia que más se olvida.
# La reserva debe seguir con un solo confirmedAt.
stripe events resend evt_1QxYz... --webhook-endpoint=we_1AbCd...

# Ver qué se envió realmente
stripe events list --limit 5
stripe logs tail
```

### Tarjetas del modo de prueba

| Número | Comportamiento | Qué ejercita |
|---|---|---|
| `4242 4242 4242 4242` | Aprobada | Camino feliz hasta `CONFIRMED` |
| `4000 0000 0000 3220` | Exige 3D Secure | Que la confirmación dependa del webhook, no del regreso |
| `4000 0000 0000 9995` | Fondos insuficientes | Que la reserva no salga de `PENDING` |

### Forzar los casos de clima sin esperar a que llueva

El pronóstico real no coopera con las pruebas. Tres formas de provocar cada rama:

```bash
# a) Bajar el umbral para que cualquier día lo supere
RAIN_THRESHOLD_PCT=5

# b) Simular la caída del proveedor: apunta a un host que no existe
OPEN_METEO_BASE_URL="https://api.open-meteo.invalid/v1/forecast"
#    → /quote debe responder 200 con precio base y WEATHER_UNAVAILABLE

# c) Fuera de ventana: elige en la UI una fecha a 30 días
#    → FORECAST_OUT_OF_RANGE, precio base, sin llamada saliente
```

Recuerda vaciar la caché entre pruebas: `npx prisma studio` y borra las filas de `WeatherCache`, o `npm run db:reset && npm run db:seed`.

---

## 12. Verificación final

Antes de dar el proyecto por terminado, estos catorce casos deben pasar.

| # | Caso | Lluvia | Días | Resultado esperado |
|---|---|---|---|---|
| T1 | Día despejado | 12 % | 3 | Precio base |
| T2 | **Justo en el umbral** | 60 % | 3 | **Sin descuento** — la regla es estrictamente mayor |
| T3 | **Un punto por encima** | 61 % | 3 | Descuento del 20 % |
| T4 | Lluvia segura, mismo día | 100 % | 0 | Descuento aplicado |
| T5 | Redondeo con precio impar | 74 % | 5 | 4 999 → 3 999, sin decimales |
| T6 | Fuera de la ventana | — | 20 | Precio base, `FORECAST_OUT_OF_RANGE`, sin llamada saliente |
| T7 | Fecha pasada | — | −1 | `400 DATE_IN_PAST` |
| T8 | Open-Meteo devuelve 429 | — | 3 | `200` con precio base; cortocircuito abierto |
| T9 | Open-Meteo agota el tiempo | — | 3 | Un reintento, luego caché vieja o precio base |
| T10 | **Precio inyectado en el cuerpo** | 12 % | 3 | `400 UNEXPECTED_FIELD`; nunca llega a Stripe |
| T11 | El clima cambia entre cotizar y pagar | 74 → 42 % | 3 | `409 PRICE_CHANGED`; sin reserva ni sesión |
| T12 | **Webhook con firma inválida** | — | — | `400`; la reserva sigue `PENDING` |
| T13 | **Webhook duplicado** | — | — | `200`; un solo `confirmedAt` |
| T14 | Sesión completada pero `unpaid` | — | — | Sigue `PENDING` hasta `async_payment_succeeded` |

### Prueba manual de T10

La más importante del conjunto, porque es la que valida la regla de oro:

```bash
curl -X POST http://localhost:3000/api/bookings/checkout ^
  -H "content-type: application/json" ^
  -d "{\"tourId\":\"TU_ID\",\"bookingDate\":\"2026-09-12\",\"timeSlot\":\"AFTERNOON\",\"customerName\":\"Prueba\",\"customerEmail\":\"a@b.com\",\"finalPriceCents\":1}"
```

Debe responder `400 UNEXPECTED_FIELD`. En PowerShell usa `` ` `` en vez de `^` para continuar líneas, o pega el comando en una sola línea.

### Lista de seguridad

**Precio**
- [ ] El esquema de `/checkout` es `.strict()`
- [ ] `unit_amount` proviene siempre de `priceBooking()`
- [ ] Una sola implementación de la regla, compartida por `/quote` y `/checkout`
- [ ] El `quoteToken` se verifica con `timingSafeEqual`, nunca se decodifica sin comprobar la firma

**Webhook**
- [ ] Cuerpo crudo con `req.text()`, sin reserializar
- [ ] Firma verificada antes de leer el contenido
- [ ] Tolerancia por defecto de 5 minutos, nunca 0
- [ ] `400` ante firma inválida, `500` ante fallo propio

**Secretos**
- [ ] Ninguna clave con prefijo `NEXT_PUBLIC_`
- [ ] `.env.local` fuera del control de versiones
- [ ] `npm run build` y buscar `sk_` en `.next/static` no devuelve nada

**Datos**
- [ ] El correo se normaliza a minúsculas
- [ ] El `sessionId` es el único identificador expuesto en la confirmación
- [ ] Los registros no incluyen cuerpos completos de eventos de Stripe

---

## 13. Qué construir después

- **Inventario de plazas** con bloqueo optimista dentro de la misma transacción que crea la reserva, liberado al expirar la sesión. Hoy dos personas pueden reservar el mismo cupo.
- **Correo de confirmación** disparado desde el webhook, con el mismo candado de idempotencia para no enviarlo dos veces.
- **Reembolsos** por `PaymentIntent`, con la transición `CONFIRMED → CANCELLED` también gobernada por eventos firmados.
- **Panel interno** que muestre, por reserva, el `weatherSnapshot` junto al precio cobrado. Es la herramienta que responde reclamaciones sin abrir la base de datos: seis meses después seguirás pudiendo explicar por qué esa reserva pagó un 20 % menos.
- **Tarea diaria** que marque `EXPIRED` las reservas `PENDING` de más de 24 horas, para los casos en que la sesión de Stripe nunca llegó a crearse.

---

*Paseo Seguro · proyecto completo v1 · septiembre 2026*
*Pronóstico: Open-Meteo `/v1/forecast` y `/v1/search` · Pagos: Stripe Checkout Sessions*
