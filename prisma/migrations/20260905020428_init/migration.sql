-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateTable
CREATE TABLE "Tour" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "slots" "TimeSlot"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "bookingDate" DATE NOT NULL,
    "timeSlot" "TimeSlot" NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "finalPriceCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "pricingRuleVersion" TEXT NOT NULL,
    "weatherSnapshot" JSONB NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amountPaidCents" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bookingId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherCache" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tour_slug_key" ON "Tour"("slug");

-- CreateIndex
CREATE INDEX "Tour_active_countryCode_idx" ON "Tour"("active", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripeSessionId_key" ON "Booking"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripePaymentIntentId_key" ON "Booking"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_customerEmail_createdAt_idx" ON "Booking"("customerEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_tourId_bookingDate_idx" ON "Booking"("tourId", "bookingDate");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_bookingId_idx" ON "ProcessedWebhookEvent"("bookingId");

-- CreateIndex
CREATE INDEX "WeatherCache_expiresAt_idx" ON "WeatherCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
