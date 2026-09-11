import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { BookingStatus } from "@/lib/time-slot";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (!HANDLED.has(event.type)) return;

  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = session.metadata?.booking_id ?? session.client_reference_id;

  if (!bookingId) {
    console.warn("[stripe] evento sin booking_id:", event.id);
    return;
  }

  await prisma.$transaction(async (tx) => {
    try {
      await tx.processedWebhookEvent.create({
        data: { id: event.id, type: event.type, bookingId },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        console.info("[stripe] evento ya procesado:", event.id);
        return;
      }
      throw e;
    }

    const next = nextStatus(event.type, session.payment_status);
    if (!next) return;

    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error(`reserva inexistente: ${bookingId}`);

    const totalEsperado = booking.finalPriceCents * booking.passengersCount;
    if (next === "CONFIRMED" && session.amount_total !== totalEsperado) {
      console.error("[ALERTA] descuadre de importe", {
        bookingId,
        esperado: totalEsperado,
        cobrado: session.amount_total,
      });
    }

    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: "PENDING" },
      data: {
        status: next,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        amountPaidCents: session.amount_total ?? null,
        confirmedAt: next === "CONFIRMED" ? new Date() : null,
      },
    });

    if (count === 0) console.info("[stripe] transición ya aplicada:", bookingId);
  });
}

function nextStatus(
  type: string,
  paymentStatus?: Stripe.Checkout.Session.PaymentStatus,
): BookingStatus | null {
  switch (type) {
    case "checkout.session.completed":
      return paymentStatus === "paid" ? "CONFIRMED" : null;
    case "checkout.session.async_payment_succeeded":
      return "CONFIRMED";
    case "checkout.session.async_payment_failed":
      return "PAYMENT_FAILED";
    case "checkout.session.expired":
      return "EXPIRED";
    default:
      return null;
  }
}
