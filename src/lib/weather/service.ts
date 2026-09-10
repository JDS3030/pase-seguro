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
  return emptyReading("WEATHER_UNAVAILABLE");
}
