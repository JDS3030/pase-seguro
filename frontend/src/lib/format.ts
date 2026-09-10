import type { TimeSlot } from "../types";

export const SLOT_LABEL: Record<TimeSlot, string> = {
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  EVENING: "Noche",
};

export const SLOT_RANGE: Record<TimeSlot, string> = {
  MORNING: "06:00 – 12:00",
  AFTERNOON: "12:00 – 18:00",
  EVENING: "18:00 – 23:00",
};

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
