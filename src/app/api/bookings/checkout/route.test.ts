import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WeatherReading } from "@/lib/weather/open-meteo";

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/weather/service", () => ({
  getRainProbability: vi.fn(),
}));

import { POST } from "./route";
import { prisma } from "@/lib/db";
import { issueQuoteToken } from "@/lib/pricing/quote-token";
import { stripe } from "@/lib/stripe/client";
import { getRainProbability } from "@/lib/weather/service";

const mockCreate = vi.mocked(stripe.checkout.sessions.create);
const mockWeather = vi.mocked(getRainProbability);

// Fecha futura dentro del rango del pronóstico
const FECHA = "2026-10-15";

function lectura(
  lluvia: number | null,
  status: WeatherReading["status"] = "FORECAST_OK",
): WeatherReading {
  return {
    status,
    rainProbability: lluvia,
    source: "LIVE",
    aggregation: "max",
    slot: "MORNING",
    hourlyUsed: [],
    endpoint: null,
    params: null,
    fetchedAt: new Date().toISOString(),
  };
}

function peticion(body: Record<string, unknown>) {
  return new Request("http://localhost/api/bookings/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let tour: Awaited<ReturnType<typeof prisma.tour.findFirstOrThrow>>;

beforeEach(async () => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreate.mockResolvedValue({ id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" } as any);
  mockWeather.mockResolvedValue(lectura(12)); // sin lluvia por defecto

  await prisma.booking.deleteMany();
  tour = await prisma.tour.findFirstOrThrow();
});

// Emite un quote token real (firmado con el secreto de test)
function quoteToken(priceCents = tour.basePriceCents, tourId = tour.id, passengers = 1) {
  return issueQuoteToken({ t: tourId, d: FECHA, s: "MORNING", f: priceCents, p: passengers, r: "rain-v1" })
    .quoteToken;
}

// Precio con descuento del 20% (2000 bps)
function precioConDescuento() {
  const desc = Math.round((tour.basePriceCents * 2000) / 10_000);
  return tour.basePriceCents - desc;
}

describe("POST /api/bookings/checkout", () => {
  it("crea la reserva PENDING y devuelve checkoutUrl + bookingId", async () => {
    const res = await POST(
      peticion({
        quoteToken: quoteToken(),
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_abc");
    expect(typeof body.bookingId).toBe("string");

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: body.bookingId } });
    expect(booking.status).toBe("PENDING");
    expect(booking.stripeSessionId).toBe("cs_test_abc");
    expect(booking.customerEmail).toBe("ana@ejemplo.com");
    expect(booking.finalPriceCents).toBe(tour.basePriceCents);
  });

  it("pasa booking_id en metadata y client_reference_id de Stripe", async () => {
    const res = await POST(
      peticion({
        quoteToken: quoteToken(),
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    const { bookingId } = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = mockCreate.mock.calls[0]![0] as any;
    expect(params.metadata?.booking_id).toBe(bookingId);
    expect(params.client_reference_id).toBe(bookingId);
    expect(params.line_items?.[0].price_data?.unit_amount).toBe(tour.basePriceCents);
    expect(params.line_items?.[0].price_data?.currency).toBe(tour.currency.toLowerCase());
  });

  it("aplica el descuento por lluvia cuando el pronóstico supera el umbral", async () => {
    mockWeather.mockResolvedValue(lectura(74)); // > 60% → descuento 20 %
    const finalEsperado = precioConDescuento();

    const res = await POST(
      peticion({
        quoteToken: quoteToken(finalEsperado),
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    expect(res.status).toBe(201);
    const { bookingId } = await res.json();
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.discountBps).toBe(2000);
    expect(booking.finalPriceCents).toBe(finalEsperado);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = mockCreate.mock.calls[0]![0] as any;
    expect(params.line_items?.[0].price_data?.unit_amount).toBe(finalEsperado);
  });

  it("devuelve 400 QUOTE_EXPIRED con token inválido", async () => {
    const res = await POST(
      peticion({
        quoteToken: "v1.cuerpo_falso.firma_falsa",
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("QUOTE_EXPIRED");
    expect(await prisma.booking.count()).toBe(0);
  });

  it("devuelve 400 VALIDATION_ERROR si el body incluye campos extra", async () => {
    const res = await POST(
      peticion({
        quoteToken: quoteToken(),
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
        precio: 1, // campo no permitido
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("devuelve 404 TOUR_NOT_FOUND si el tour del token no existe", async () => {
    const res = await POST(
      peticion({
        quoteToken: quoteToken(tour.basePriceCents, "tour-inexistente-xyz"),
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("TOUR_NOT_FOUND");
  });

  it("devuelve 409 PRICE_CHANGED cuando el pronóstico cambió tras la cotización", async () => {
    // El token cotizó el precio COMPLETO (sin lluvia), pero ahora llueve fuerte
    mockWeather.mockResolvedValue(lectura(80));

    const res = await POST(
      peticion({
        quoteToken: quoteToken(tour.basePriceCents), // precio sin descuento
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("PRICE_CHANGED");
    expect(body.error.details.previousPriceCents).toBe(tour.basePriceCents);
    expect(body.error.details.currentPriceCents).toBeLessThan(tour.basePriceCents);

    // No se crea ninguna reserva
    expect(await prisma.booking.count()).toBe(0);
  });

  it("devuelve 502 y marca la reserva PAYMENT_FAILED si Stripe lanza error", async () => {
    mockCreate.mockRejectedValue(new Error("Stripe caído"));

    const res = await POST(
      peticion({
        quoteToken: quoteToken(),
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("PAYMENT_PROVIDER_ERROR");

    const bookings = await prisma.booking.findMany();
    expect(bookings).toHaveLength(1);
    expect(bookings[0].status).toBe("PAYMENT_FAILED");
  });

  it("no llama a Stripe si el token ya expiró", async () => {
    const res = await POST(
      peticion({
        quoteToken: "v1.expirado.firma",
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("devuelve 409 CAPACITY_EXCEEDED cuando el cupo está lleno", async () => {
    // Llenamos el tour con una reserva CONFIRMED que ocupa todo el cupo
    await prisma.booking.create({
      data: {
        tourId: tour.id,
        customerName: "Lleno",
        customerEmail: "lleno@test.com",
        bookingDate: new Date(FECHA),
        timeSlot: "MORNING",
        passengersCount: tour.maxCapacity,
        basePriceCents: tour.basePriceCents,
        discountBps: 0,
        discountCents: 0,
        finalPriceCents: tour.basePriceCents,
        currency: tour.currency,
        pricingRuleVersion: "rain-v1",
        weatherSnapshot: {},
        status: "CONFIRMED",
      },
    });

    const res = await POST(
      peticion({
        quoteToken: quoteToken(tour.basePriceCents, tour.id, 1),
        customerName: "Ana García",
        customerEmail: "ana@ejemplo.com",
      }),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CAPACITY_EXCEEDED");
    expect(body.error.details.availableSpots).toBe(0);
    expect(body.error.details.requestedSpots).toBe(1);

    // Solo existe la reserva de "Lleno" — no se creó ninguna nueva
    expect(await prisma.booking.count()).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
