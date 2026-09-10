"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatDate, SLOT_LABEL } from "@/lib/format";

type Booking = {
  bookingId: string;
  status: "PENDING" | "CONFIRMED" | "PAYMENT_FAILED" | "EXPIRED" | "CANCELLED";
  confirmedAt: string | null;
  customerName: string;
  tour: { title: string; slug: string; locationName: string };
  bookingDate: string;
  timeSlot: "MORNING" | "AFTERNOON" | "EVENING";
  price: {
    basePriceCents: number;
    discountCents: number;
    finalPriceCents: number;
    currency: string;
    discountApplied: boolean;
  };
  weather: { rainProbability: number | null };
};

const POLL_MS = 1500;
const TIMEOUT_MS = 30_000;

export function ConfirmationView({ sessionId }: { sessionId: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/bookings/by-session/${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          if (Date.now() - startedAt < TIMEOUT_MS) return void setTimeout(poll, POLL_MS);
          setError(data?.error?.message ?? "No encontramos esa reserva.");
          return;
        }

        if (cancelled) return;
        setBooking(data);

        if (data.status === "PENDING") {
          if (Date.now() - startedAt < TIMEOUT_MS) setTimeout(poll, POLL_MS);
          else setTimedOut(true);
        }
      } catch {
        if (Date.now() - startedAt < TIMEOUT_MS) setTimeout(poll, POLL_MS);
        else setTimedOut(true);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="confirm">
        <h1>No encontramos tu reserva</h1>
        <p className="muted">{error}</p>
        <p><a href="/">Volver al catálogo</a></p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="confirm">
        <h1><span className="spinner" aria-hidden="true" /> Confirmando tu pago…</h1>
        <p className="muted">Esto suele tardar un par de segundos.</p>
      </div>
    );
  }

  const isConfirmed = booking.status === "CONFIRMED";
  const isPending = booking.status === "PENDING";

  return (
    <div className="confirm">
      <span className={`badge ${isConfirmed ? "ok" : isPending ? "warn" : "danger"}`}>
        {booking.status}
      </span>

      <h1 style={{ marginTop: 14 }}>
        {isConfirmed
          ? `Listo, ${booking.customerName.split(" ")[0]}`
          : isPending
            ? "Estamos confirmando tu pago"
            : "El pago no se completó"}
      </h1>

      <p className="muted">
        {isConfirmed
          ? "Tu reserva quedó confirmada. Te enviamos el detalle por correo."
          : isPending && timedOut
            ? "Tu banco todavía no confirma la operación. No cierres esta página; si tarda más de unos minutos, escríbenos con el número de reserva."
            : isPending
              ? "Un momento, estamos verificando con la pasarela de pago."
              : "No se realizó ningún cobro. Puedes intentarlo de nuevo desde la página del tour."}
      </p>

      <dl className="summary">
        <div><dt>Reserva</dt><dd style={{ fontFamily: "var(--mono)", fontSize: ".85rem" }}>{booking.bookingId}</dd></div>
        <div><dt>Tour</dt><dd>{booking.tour.title}</dd></div>
        <div><dt>Destino</dt><dd>{booking.tour.locationName}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(booking.bookingDate)}</dd></div>
        <div><dt>Franja</dt><dd>{SLOT_LABEL[booking.timeSlot]}</dd></div>
        {booking.weather.rainProbability !== null && (
          <div><dt>Lluvia prevista</dt><dd>{booking.weather.rainProbability}&nbsp;%</dd></div>
        )}
        {booking.price.discountApplied && (
          <div>
            <dt>Descuento por lluvia</dt>
            <dd style={{ color: "var(--ok)" }}>
              −{formatMoney(booking.price.discountCents, booking.price.currency)}
            </dd>
          </div>
        )}
        <div>
          <dt>Total</dt>
          <dd style={{ fontWeight: 700 }}>
            {formatMoney(booking.price.finalPriceCents, booking.price.currency)}
          </dd>
        </div>
      </dl>

      <p style={{ marginTop: 26 }}>
        <a href={`/tours/${booking.tour.slug}`}>Volver al tour</a> ·{" "}
        <a href="/">Ver todos los tours</a>
      </p>
    </div>
  );
}
