import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getRainProbability } from "@/lib/weather/service";
import { checkBookingWindow } from "@/lib/weather/window";
import { priceBooking } from "@/lib/pricing/engine";
import { issueQuoteToken } from "@/lib/pricing/quote-token";
import { checkAvailability } from "@/lib/availability/capacity";
import type { TimeSlot } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    tourId: z.string().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato esperado YYYY-MM-DD"),
    timeSlot: z.enum(["MORNING", "AFTERNOON", "EVENING"]),
    passengersCount: z.number().int().min(1).max(20).default(1),
  })
  .strict();

export async function POST(req: Request) {
  const limit = rateLimit(`quote:${clientIp(req)}`, 20);
  if (!limit.allowed) return fail(429, "RATE_LIMITED", ERROR_MESSAGES.RATE_LIMITED);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", ERROR_MESSAGES.VALIDATION_ERROR, parsed.error.flatten());
  }
  const input = parsed.data;

  const tour = await prisma.tour.findFirst({ where: { id: input.tourId, active: true } });
  if (!tour) return fail(404, "TOUR_NOT_FOUND", ERROR_MESSAGES.TOUR_NOT_FOUND);

  if (!tour.slots.includes(input.timeSlot)) {
    return fail(400, "SLOT_NOT_OFFERED", ERROR_MESSAGES.SLOT_NOT_OFFERED);
  }

  const win = checkBookingWindow(input.bookingDate, tour.timezone);
  if (!win.ok) return fail(400, win.code, ERROR_MESSAGES[win.code]);

  const avail = await checkAvailability({
    tourId: tour.id,
    bookingDate: input.bookingDate,
    timeSlot: input.timeSlot as TimeSlot,
    requestedSpots: input.passengersCount,
  });

  if (!avail.isAvailable) {
    const code = avail.availableSpots === 0 ? "SOLD_OUT" : "CAPACITY_EXCEEDED";
    return fail(409, code, ERROR_MESSAGES[code], {
      availableSpots: avail.availableSpots,
      requestedSpots: input.passengersCount,
    });
  }

  const reading = await getRainProbability(tour, input.bookingDate, input.timeSlot);
  const price = priceBooking({ basePriceCents: tour.basePriceCents, reading });

  const quote = issueQuoteToken({
    t: tour.id,
    d: input.bookingDate,
    s: input.timeSlot,
    f: price.finalPriceCents,
    p: input.passengersCount,
    r: price.ruleVersion,
  });

  return ok({
    tour: {
      id: tour.id,
      slug: tour.slug,
      title: tour.title,
      locationName: tour.locationName,
      timezone: tour.timezone,
    },
    bookingDate: input.bookingDate,
    timeSlot: input.timeSlot,
    passengersCount: input.passengersCount,
    availability: {
      maxCapacity: avail.maxCapacity,
      availableSpots: avail.availableSpots,
    },
    weather: {
      status: reading.status,
      rainProbability: reading.rainProbability,
      source: reading.source,
      aggregation: reading.aggregation,
      observedAt: reading.fetchedAt,
    },
    price: { ...price, currency: tour.currency },
    ...quote,
  });
}
