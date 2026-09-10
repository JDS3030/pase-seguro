const BASE = "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "content-type": "application/json" },
      ...init,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. ¿Está corriendo el backend en el puerto 3000?");
  }

  // Parsea el cuerpo sólo si existe (evita "Unexpected end of JSON input" con cuerpos vacíos)
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!res.ok) {
    const msg = (data?.error as { message?: string } | undefined)?.message
      ?? `Error ${res.status} — ${res.statusText || path}`;
    throw Object.assign(new Error(msg), {
      code:    (data?.error as { code?: string } | undefined)?.code,
      status:  res.status,
      details: (data?.error as { details?: unknown } | undefined)?.details,
    });
  }
  return data as T;
}

export const api = {
  tours: {
    list: (q?: string) =>
      request<{ data: import("../types").Tour[] }>(`/tours${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    get: (idOrSlug: string) =>
      request<import("../types").Tour & { forecastWindow: { minDate: string; maxDate: string; maxForecastDate: string } }>(`/tours/${idOrSlug}`),
  },
  bookings: {
    quote: (body: { tourId: string; bookingDate: string; timeSlot: string; passengersCount: number }) =>
      request<import("../types").Quote>("/bookings/quote", { method: "POST", body: JSON.stringify(body) }),
    checkout: (body: { quoteToken: string; customerName: string; customerEmail: string }) =>
      request<{ checkoutUrl: string; bookingId: string }>("/bookings/checkout", { method: "POST", body: JSON.stringify(body) }),
    bySession: (sessionId: string) =>
      request<import("../types").BookingDetail>(`/bookings/by-session/${sessionId}`),
  },
};
