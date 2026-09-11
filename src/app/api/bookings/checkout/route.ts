import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyQuoteToken } from "@/lib/pricing/quote-token";
import { getRainProbability } from "@/lib/weather/service";
import { priceBooking } from "@/lib/pricing/engine";
import { checkAvailability } from "@/lib/availability/capacity";
import { stripe } from "@/lib/stripe/client";
import { env } from "@/lib/env";
import type { SlotKey } from "@/lib/weather/open-meteo";
import type { TimeSlot } from "@/lib/time-slot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    quoteToken: z.string().min(1),
    customerName: z.string().min(2).max(100),
    customerEmail: z.string().email(),
  })
  .strict();

export async function POST(req: Request) {
  const limit = rateLimit(`checkout:${clientIp(req)}`, 10);
  if (!limit.allowed) return fail(429, "RATE_LIMITED", ERROR_MESSAGES.RATE_LIMITED);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", ERROR_MESSAGES.VALIDATION_ERROR, parsed.error.flatten());
  }
  const { quoteToken, customerName, customerEmail } = parsed.data;

  const quote = verifyQuoteToken(quoteToken);
  if (!quote) return fail(400, "QUOTE_EXPIRED", ERROR_MESSAGES.QUOTE_EXPIRED);

  const tour = await prisma.tour.findFirst({ where: { id: quote.t, active: true } });
  if (!tour) return fail(404, "TOUR_NOT_FOUND", ERROR_MESSAGES.TOUR_NOT_FOUND);

  // Re-compute price to catch forecast changes since the quote was issued
  const reading = await getRainProbability(tour, quote.d, quote.s as SlotKey);
  const price = priceBooking({ basePriceCents: tour.basePriceCents, reading });

  if (price.finalPriceCents !== quote.f) {
    return fail(409, "PRICE_CHANGED", ERROR_MESSAGES.PRICE_CHANGED, {
      previousPriceCents: quote.f,
      currentPriceCents: price.finalPriceCents,
    });
  }

  // Atomic: check availability + create booking in one transaction
  const txResult = await prisma.$transaction(async (tx) => {
    const avail = await checkAvailability({
      tourId: tour.id,
      bookingDate: quote.d,
      timeSlot: quote.s as TimeSlot,
      requestedSpots: quote.p,
      tx,
    });

    if (!avail.isAvailable) {
      return { ok: false as const, avail };
    }

    const booking = await tx.booking.create({
      data: {
        tourId: tour.id,
        customerName,
        customerEmail,
        bookingDate: new Date(quote.d),
        timeSlot: quote.s as SlotKey,
        passengersCount: quote.p,
        basePriceCents: price.basePriceCents,
        discountBps: price.discountBps,
        discountCents: price.discountCents,
        finalPriceCents: price.finalPriceCents,
        currency: tour.currency,
        pricingRuleVersion: price.ruleVersion,
        weatherSnapshot: reading as unknown as object,
      },
    });

    return { ok: true as const, booking };
  });

  if (!txResult.ok) {
    return fail(409, "CAPACITY_EXCEEDED", ERROR_MESSAGES.CAPACITY_EXCEEDED, {
      availableSpots: txResult.avail.availableSpots,
      requestedSpots: quote.p,
    });
  }

  const { booking } = txResult;

  // Mock mode: skip real Stripe, redirect to local payment terminal
  if (env.MOCK_STRIPE) {
    const mockSessionId = `cs_mock_${booking.id}`;
    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: mockSessionId },
    });
    return ok({ checkoutUrl: `${env.APP_URL}/mock-pago/${booking.id}`, bookingId: booking.id }, 201);
  }

  let stripeSession: { id: string; url: string | null };
  try {
    stripeSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: customerEmail,
        client_reference_id: booking.id,
        metadata: { booking_id: booking.id },
        line_items: [
          {
            quantity: quote.p,                   // pasajeros — Stripe multiplica el total
            price_data: {
              currency: tour.currency.toLowerCase(),
              unit_amount: price.finalPriceCents, // precio unitario por persona
              product_data: {
                name: tour.title,
                description: `${quote.d} · ${quote.s} · ${tour.locationName}`,
              },
            },
          },
        ],
        success_url: `${env.FRONTEND_URL}/reservas/confirmacion?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.FRONTEND_URL}/tours/${tour.slug}`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      { idempotencyKey: booking.id },
    );
  } catch (err) {
    console.error("[checkout] stripe error:", err);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "PAYMENT_FAILED" },
    });
    return fail(502, "PAYMENT_PROVIDER_ERROR", ERROR_MESSAGES.PAYMENT_PROVIDER_ERROR);
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripeSessionId: stripeSession.id },
  });

  return ok({ checkoutUrl: stripeSession.url, bookingId: booking.id }, 201);
}
