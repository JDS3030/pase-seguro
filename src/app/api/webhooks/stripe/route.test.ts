import { describe, it, expect, beforeEach } from "vitest";
import Stripe from "stripe";
import { POST } from "./route";
import { prisma } from "@/lib/db";

const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
let bookingId: string;

function evento(id = "evt_test_1") {
  return {
    id,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        payment_status: "paid",
        amount_total: 7120,
        payment_intent: "pi_test_123",
        client_reference_id: bookingId,
        metadata: { booking_id: bookingId },
      },
    },
  };
}

function peticionFirmada(cuerpo: object, secret = SECRET) {
  const payload = JSON.stringify(cuerpo);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": header, "content-type": "application/json" },
  });
}

beforeEach(async () => {
  await prisma.processedWebhookEvent.deleteMany();
  await prisma.booking.deleteMany();

  const tour = await prisma.tour.findFirstOrThrow();
  const booking = await prisma.booking.create({
    data: {
      tourId: tour.id,
      customerName: "Prueba",
      customerEmail: "prueba@ejemplo.com",
      bookingDate: new Date("2026-09-12T00:00:00Z"),
      timeSlot: "AFTERNOON",
      basePriceCents: 8900,
      discountBps: 2000,
      discountCents: 1780,
      finalPriceCents: 7120,
      currency: "USD",
      pricingRuleVersion: "rain-v1",
      weatherSnapshot: { rainProbability: 74 },
      status: "PENDING",
      stripeSessionId: "cs_test_123",
    },
  });
  bookingId = booking.id;
});

describe("webhook de Stripe", () => {
  it("rechaza una firma que no corresponde y no toca la reserva", async () => {
    const res = await POST(peticionFirmada(evento(), "whsec_secreto_incorrecto"));

    expect(res.status).toBe(400);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe("PENDING");
  });

  it("rechaza un cuerpo alterado después de firmar", async () => {
    const payload = JSON.stringify(evento());
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const alterado = payload.replace('"amount_total":7120', '"amount_total":1');

    const res = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: alterado,
        headers: { "stripe-signature": header },
      }),
    );

    expect(res.status).toBe(400);
  });

  it("confirma la reserva y guarda el payment_intent", async () => {
    const res = await POST(peticionFirmada(evento()));

    expect(res.status).toBe(200);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe("CONFIRMED");
    expect(b.stripePaymentIntentId).toBe("pi_test_123");
    expect(b.confirmedAt).not.toBeNull();
  });

  it("confirma UNA sola vez ante entregas duplicadas", async () => {
    expect((await POST(peticionFirmada(evento()))).status).toBe(200);
    const primera = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    expect((await POST(peticionFirmada(evento()))).status).toBe(200);
    const segunda = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    expect(segunda.confirmedAt).toEqual(primera.confirmedAt);
    expect(await prisma.processedWebhookEvent.count()).toBe(1);
  });

  it("deja la reserva en PENDING si el pago es asíncrono y aún no llegó", async () => {
    const e = evento("evt_test_async");
    e.data.object.payment_status = "unpaid";

    expect((await POST(peticionFirmada(e))).status).toBe(200);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe("PENDING");
  });
});
