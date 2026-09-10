import { env } from "@/lib/env";

export const FORECAST_MAX_DAYS = env.FORECAST_MAX_DAYS;
export const BOOKING_MAX_DAYS = 365;

export function todayInTimezone(timezone: string, now = new Date()): string {
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
