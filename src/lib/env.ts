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
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  QUOTE_SIGNING_SECRET: z.string().min(16),
  MOCK_STRIPE: z.coerce.boolean().default(false),
});

const parsed = Schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuración inválida:", parsed.error.flatten().fieldErrors);
  throw new Error("Revisa tu .env.local contra .env.example");
}

export const env = parsed.data;
