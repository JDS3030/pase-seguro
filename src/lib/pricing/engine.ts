import { env } from "@/lib/env";
import type { WeatherReading } from "@/lib/weather/open-meteo";

export const PRICING_RULE_VERSION = "rain-v1";
export const RAIN_THRESHOLD_PCT = env.RAIN_THRESHOLD_PCT;
export const WEATHER_DISCOUNT_BPS = env.WEATHER_DISCOUNT_BPS;
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
