export type TimeSlot = "MORNING" | "AFTERNOON" | "EVENING";
export type BookingStatus = "PENDING" | "CONFIRMED" | "PAYMENT_FAILED" | "EXPIRED" | "CANCELLED";

export interface Tour {
  id: string;
  slug: string;
  title: string;
  description: string;
  locationName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  basePriceCents: number;
  currency: string;
  durationMin: number;
  slots: TimeSlot[];
  maxCapacity: number;
}

export interface QuoteWeather {
  status: "FORECAST_OK" | "FORECAST_STALE" | "FORECAST_OUT_OF_RANGE" | "WEATHER_UNAVAILABLE";
  rainProbability: number | null;
  source: string;
  observedAt: string;
}

export interface QuotePrice {
  basePriceCents: number;
  discountBps: number;
  discountCents: number;
  finalPriceCents: number;
  currency: string;
  discountApplied: boolean;
  thresholdPct: number;
}

export interface Quote {
  tour: Pick<Tour, "id" | "slug" | "title" | "locationName" | "timezone">;
  bookingDate: string;
  timeSlot: TimeSlot;
  passengersCount: number;
  availability: { maxCapacity: number; availableSpots: number };
  weather: QuoteWeather;
  price: QuotePrice;
  quoteToken: string;
  quoteExpiresAt: string;
}

export interface BookingDetail {
  bookingId: string;
  status: BookingStatus;
  confirmedAt: string | null;
  customerName: string;
  tour: { title: string; slug: string; locationName: string };
  bookingDate: string;
  timeSlot: TimeSlot;
  price: {
    basePriceCents: number;
    discountCents: number;
    finalPriceCents: number;
    currency: string;
    discountApplied: boolean;
  };
  weather: { rainProbability: number | null };
}
