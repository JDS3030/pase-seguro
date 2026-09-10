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

export async function fetchForecast(input: {
  latitude: number;
  longitude: number;
  timezone: string;
  date: string;
  slot: SlotKey;
}): Promise<WeatherReading> {
  const params: Record<string, string> = {
    latitude: input.latitude.toFixed(4),
    longitude: input.longitude.toFixed(4),
    hourly: "precipitation_probability",
    daily: "precipitation_probability_max",
    timezone: input.timezone,
    start_date: input.date,
    end_date: input.date,
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

  const dayIdx = data.daily?.time.indexOf(date) ?? -1;
  const daily = dayIdx >= 0 ? data.daily?.precipitation_probability_max[dayIdx] : null;

  return {
    value: typeof daily === "number" ? daily : null,
    used,
    aggregation: typeof daily === "number" ? "daily_max" : null,
  };
}
