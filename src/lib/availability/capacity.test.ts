import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { checkAvailability, HOLD_WINDOW_MINUTES } from "./capacity";

const FECHA = "2026-11-20";
const SLOT = "MORNING" as const;

let tour: Awaited<ReturnType<typeof prisma.tour.findFirstOrThrow>>;

function booking(overrides: {
  status?: "CONFIRMED" | "PENDING" | "PAYMENT_FAILED" | "EXPIRED";
  passengersCount?: number;
  createdAt?: Date;
}) {
  return prisma.booking.create({
    data: {
      tourId: tour.id,
      customerName: "Test",
      customerEmail: "test@test.com",
      bookingDate: new Date(FECHA),
      timeSlot: SLOT,
      passengersCount: overrides.passengersCount ?? 1,
      basePriceCents: tour.basePriceCents,
      discountBps: 0,
      discountCents: 0,
      finalPriceCents: tour.basePriceCents,
      currency: "USD",
      pricingRuleVersion: "rain-v1",
      weatherSnapshot: {},
      status: overrides.status ?? "PENDING",
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

beforeEach(async () => {
  await prisma.booking.deleteMany();
  tour = await prisma.tour.findFirstOrThrow();
});

describe("checkAvailability", () => {
  it("devuelve capacidad completa sin reservas", async () => {
    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 1,
    });

    expect(result.maxCapacity).toBe(tour.maxCapacity);
    expect(result.confirmedSpots).toBe(0);
    expect(result.pendingSpots).toBe(0);
    expect(result.availableSpots).toBe(tour.maxCapacity);
    expect(result.isAvailable).toBe(true);
  });

  it("descuenta los pasajeros CONFIRMED del cupo disponible", async () => {
    await booking({ status: "CONFIRMED", passengersCount: 4 });

    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 1,
    });

    expect(result.confirmedSpots).toBe(4);
    expect(result.availableSpots).toBe(tour.maxCapacity - 4);
    expect(result.isAvailable).toBe(true);
  });

  it("descuenta las reservas PENDING recientes del cupo disponible", async () => {
    await booking({ status: "PENDING", passengersCount: 3 }); // createdAt = ahora

    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 1,
    });

    expect(result.pendingSpots).toBe(3);
    expect(result.availableSpots).toBe(tour.maxCapacity - 3);
  });

  it("ignora las reservas PENDING más antiguas que la ventana de retención", async () => {
    const vencido = new Date(Date.now() - (HOLD_WINDOW_MINUTES + 1) * 60_000);
    await booking({ status: "PENDING", passengersCount: 5, createdAt: vencido });

    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 1,
    });

    expect(result.pendingSpots).toBe(0); // expirados → no cuentan
    expect(result.availableSpots).toBe(tour.maxCapacity);
    expect(result.isAvailable).toBe(true);
  });

  it("no descuenta reservas PAYMENT_FAILED ni EXPIRED", async () => {
    await booking({ status: "PAYMENT_FAILED", passengersCount: 6 });
    await booking({ status: "EXPIRED", passengersCount: 4 });

    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 1,
    });

    expect(result.bookedSpots).toBe(0);
    expect(result.availableSpots).toBe(tour.maxCapacity);
  });

  it("isAvailable = false cuando el cupo está lleno exactamente", async () => {
    await booking({ status: "CONFIRMED", passengersCount: tour.maxCapacity });

    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 1,
    });

    expect(result.availableSpots).toBe(0);
    expect(result.isAvailable).toBe(false);
  });

  it("isAvailable = false cuando los pasajeros solicitados superan el cupo restante", async () => {
    await booking({ status: "CONFIRMED", passengersCount: tour.maxCapacity - 2 });

    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 3, // solo quedan 2
    });

    expect(result.availableSpots).toBe(2);
    expect(result.isAvailable).toBe(false);
  });

  it("combina CONFIRMED y PENDING recientes correctamente", async () => {
    await booking({ status: "CONFIRMED", passengersCount: 5 });
    await booking({ status: "PENDING", passengersCount: 3 }); // reciente

    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 1,
    });

    expect(result.confirmedSpots).toBe(5);
    expect(result.pendingSpots).toBe(3);
    expect(result.bookedSpots).toBe(8);
    expect(result.availableSpots).toBe(tour.maxCapacity - 8);
  });

  it("no mezcla disponibilidad de otro tour", async () => {
    const otroTour = await prisma.tour.findFirstOrThrow({
      where: { id: { not: tour.id } },
    });
    await prisma.booking.create({
      data: {
        tourId: otroTour.id,
        customerName: "Otro",
        customerEmail: "otro@test.com",
        bookingDate: new Date(FECHA),
        timeSlot: SLOT,
        passengersCount: tour.maxCapacity,
        basePriceCents: otroTour.basePriceCents,
        discountBps: 0,
        discountCents: 0,
        finalPriceCents: otroTour.basePriceCents,
        currency: "USD",
        pricingRuleVersion: "rain-v1",
        weatherSnapshot: {},
        status: "CONFIRMED",
      },
    });

    const result = await checkAvailability({
      tourId: tour.id,
      bookingDate: FECHA,
      timeSlot: SLOT,
      requestedSpots: 1,
    });

    expect(result.availableSpots).toBe(tour.maxCapacity); // el tour correcto sigue libre
  });
});
