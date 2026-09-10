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
