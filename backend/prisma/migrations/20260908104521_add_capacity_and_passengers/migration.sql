-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "passengersCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "maxCapacity" INTEGER NOT NULL DEFAULT 15;

-- CreateIndex
CREATE INDEX "Booking_tourId_bookingDate_timeSlot_status_idx" ON "Booking"("tourId", "bookingDate", "timeSlot", "status");
