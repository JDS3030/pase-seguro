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
    ["justo en el umbral",         8900,  60,     8900,  false],
    ["un punto por encima",        8900,  61,     7120,  true],
    ["lluvia segura",              8900,  100,    7120,  true],
    ["redondeo con precio impar",  4999,  74,     3999,  true],
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
