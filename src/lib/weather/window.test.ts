import { describe, it, expect } from "vitest";
import { todayInTimezone, daysAhead, checkBookingWindow } from "./window";

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
    expect(r.ok && r.withinForecast).toBe(false);
  });

  it("rechaza más allá de un año", () => {
    const r = checkBookingWindow("2028-01-01", "America/Santo_Domingo", MEDIANOCHE_UTC);
    expect(r).toEqual({ ok: false, code: "DATE_TOO_FAR" });
  });
});
