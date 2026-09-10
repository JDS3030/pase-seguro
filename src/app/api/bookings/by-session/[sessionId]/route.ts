import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";
import { toDateString } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  if (!sessionId.startsWith("cs_")) {
    return fail(404, "BOOKING_NOT_FOUND", ERROR_MESSAGES.BOOKING_NOT_FOUND);
  }

  const booking = await prisma.booking.findUnique({
    where: { stripeSessionId: sessionId },
    include: { tour: { select: { title: true, slug: true, locationName: true } } },
  });

  if (!booking) return fail(404, "BOOKING_NOT_FOUND", ERROR_MESSAGES.BOOKING_NOT_FOUND);

  const snapshot = booking.weatherSnapshot as { rainProbability?: number | null } | null;

  return ok({
    bookingId: booking.id,
    status: booking.status,
    confirmedAt: booking.confirmedAt,
    customerName: booking.customerName,
    tour: booking.tour,
    bookingDate: toDateString(booking.bookingDate),
    timeSlot: booking.timeSlot,
    passengersCount: booking.passengersCount,
    price: {
      basePriceCents: booking.basePriceCents,
      discountCents: booking.discountCents,
      finalPriceCents: booking.finalPriceCents,
      currency: booking.currency,
      discountApplied: booking.discountBps > 0,
    },
    weather: { rainProbability: snapshot?.rainProbability ?? null },
  });
}
