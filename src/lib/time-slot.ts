export type TimeSlot = "MORNING" | "AFTERNOON" | "EVENING";
export type BookingStatus = "PENDING" | "CONFIRMED" | "PAYMENT_FAILED" | "CANCELLED";

export const TIME_SLOTS: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING"];
export const BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "PAYMENT_FAILED", "CANCELLED"];
