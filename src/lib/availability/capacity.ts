import { prisma } from "@/lib/db";
import { type Prisma, type TimeSlot } from "@prisma/client";

export const HOLD_WINDOW_MINUTES = 15;

export interface AvailabilityResult {
  maxCapacity: number;
  confirmedSpots: number;
  pendingSpots: number;
  bookedSpots: number;
  availableSpots: number;
  isAvailable: boolean;
}

export async function checkAvailability(args: {
  tourId: string;
  bookingDate: string; // YYYY-MM-DD
  timeSlot: TimeSlot;
  requestedSpots: number;
  tx?: Prisma.TransactionClient;
}): Promise<AvailabilityResult> {
  const db = args.tx ?? prisma;
  const holdCutoff = new Date(Date.now() - HOLD_WINDOW_MINUTES * 60_000);

  const tour = await db.tour.findUnique({
    where: { id: args.tourId },
    select: { maxCapacity: true },
  });

  if (!tour) throw new Error(`Tour not found: ${args.tourId}`);

  const date = new Date(args.bookingDate);

  const [confirmedAgg, pendingAgg] = await Promise.all([
    db.booking.aggregate({
      where: { tourId: args.tourId, bookingDate: date, timeSlot: args.timeSlot, status: "CONFIRMED" },
      _sum: { passengersCount: true },
    }),
    db.booking.aggregate({
      where: {
        tourId: args.tourId,
        bookingDate: date,
        timeSlot: args.timeSlot,
        status: "PENDING",
        createdAt: { gte: holdCutoff },
      },
      _sum: { passengersCount: true },
    }),
  ]);

  const confirmedSpots = confirmedAgg._sum.passengersCount ?? 0;
  const pendingSpots = pendingAgg._sum.passengersCount ?? 0;
  const bookedSpots = confirmedSpots + pendingSpots;
  const availableSpots = Math.max(0, tour.maxCapacity - bookedSpots);

  return {
    maxCapacity: tour.maxCapacity,
    confirmedSpots,
    pendingSpots,
    bookedSpots,
    availableSpots,
    isAvailable: availableSpots >= args.requestedSpots,
  };
}
