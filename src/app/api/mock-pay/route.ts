import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  bookingId: z.string().min(1),
  action: z.enum(["success", "fail", "cancel"]),
}).strict();

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR");

  const { bookingId, action } = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !booking.stripeSessionId?.startsWith("cs_mock_")) {
    return fail(404, "BOOKING_NOT_FOUND");
  }

  if (action === "success") {
    await prisma.booking.update({
      where: { id: bookingId, status: "PENDING" },
      data: {
        status: "CONFIRMED",
        stripePaymentIntentId: `pi_mock_${bookingId}`,
        amountPaidCents: booking.finalPriceCents,
        confirmedAt: new Date(),
      },
    });
  } else {
    await prisma.booking.update({
      where: { id: bookingId, status: "PENDING" },
      data: { status: action === "cancel" ? "CANCELLED" : "PAYMENT_FAILED" },
    });
  }

  return ok({ sessionId: booking.stripeSessionId });
}
