import { NextResponse } from "next/server";

export function requestId(): string {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

export function fail(
  status: number,
  code: string,
  message?: string,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message: message ?? code, details }, requestId: requestId() },
    { status },
  );
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Los datos enviados no son válidos.",
  UNEXPECTED_FIELD: "La petición incluye campos que no se aceptan.",
  TOUR_NOT_FOUND: "No encontramos ese tour.",
  DATE_IN_PAST: "La fecha seleccionada ya pasó.",
  DATE_TOO_FAR: "La fecha seleccionada excede el máximo de 365 días.",
  SLOT_NOT_OFFERED: "Ese tour no se ofrece en la franja seleccionada.",
  QUOTE_EXPIRED: "Tu cotización caducó. Vuelve a consultar el precio.",
  PRICE_CHANGED: "El pronóstico cambió desde tu cotización.",
  RATE_LIMITED: "Demasiadas peticiones. Espera un momento.",
  PAYMENT_PROVIDER_ERROR: "No pudimos iniciar el pago. Inténtalo de nuevo.",
  BOOKING_NOT_FOUND: "No encontramos esa reserva.",
  CAPACITY_EXCEEDED: "No hay suficientes cupos disponibles para tu selección.",
  SOLD_OUT: "Esta franja no tiene cupos disponibles.",
};
