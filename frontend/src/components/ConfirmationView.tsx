import { useEffect, useState } from "react";
import type { BookingDetail } from "../types";
import { api } from "../lib/api";
import { formatMoney, formatDate, SLOT_LABEL } from "../lib/format";

const POLL_MS    = 1_500;
const TIMEOUT_MS = 30_000;

export function ConfirmationView({ sessionId }: { sessionId: string }) {
  const [booking,  setBooking]  = useState<BookingDetail | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [error]                 = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start   = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const data = await api.bookings.bySession(sessionId);
        if (cancelled) return;
        setBooking(data);
        if (data.status === "PENDING") {
          if (Date.now() - start < TIMEOUT_MS) setTimeout(poll, POLL_MS);
          else setTimedOut(true);
        }
      } catch {
        if (Date.now() - start < TIMEOUT_MS) setTimeout(poll, POLL_MS);
        else setTimedOut(true);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (error) return (
    <div className="confirm">
      <h1>No encontramos tu reserva</h1>
      <p className="muted">{error}</p>
      <a href="/tours">Volver al catálogo</a>
    </div>
  );

  if (!booking) return (
    <div className="confirm">
      <h1><span className="spinner" aria-hidden="true" /> Confirmando tu pago…</h1>
      <p className="muted">Esto suele tardar un par de segundos.</p>
    </div>
  );

  const ok      = booking.status === "CONFIRMED";
  const pending = booking.status === "PENDING";

  return (
    <div className="confirm">
      <span className={`badge ${ok ? "ok" : pending ? "warn" : "danger"}`}>{booking.status}</span>

      <h1 style={{ marginTop: 14 }}>
        {ok      ? `Listo, ${booking.customerName.split(" ")[0]}`
        : pending ? "Estamos confirmando tu pago"
        : "El pago no se completó"}
      </h1>

      <p className="muted">
        {ok      ? "Tu reserva quedó confirmada. Te enviamos el detalle por correo."
        : pending && timedOut
                 ? "Tu banco aún no confirma. No cierres esta página; si tarda más de unos minutos, escríbenos con el número de reserva."
        : pending ? "Un momento, verificando con la pasarela de pago."
        : "No se realizó ningún cobro. Intenta de nuevo desde la página del tour."}
      </p>

      <dl className="summary">
        <div><dt>Reserva</dt><dd style={{ fontFamily: "monospace", fontSize: ".85rem" }}>{booking.bookingId}</dd></div>
        <div><dt>Tour</dt><dd>{booking.tour.title}</dd></div>
        <div><dt>Destino</dt><dd>{booking.tour.locationName}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(booking.bookingDate)}</dd></div>
        <div><dt>Franja</dt><dd>{SLOT_LABEL[booking.timeSlot]}</dd></div>
        {booking.weather.rainProbability !== null && (
          <div><dt>Lluvia prevista</dt><dd>{booking.weather.rainProbability} %</dd></div>
        )}
        {booking.price.discountApplied && (
          <div>
            <dt>Descuento por lluvia</dt>
            <dd style={{ color: "var(--ok)" }}>−{formatMoney(booking.price.discountCents, booking.price.currency)}</dd>
          </div>
        )}
        <div>
          <dt>Total</dt>
          <dd style={{ fontWeight: 700 }}>{formatMoney(booking.price.finalPriceCents * booking.passengersCount, booking.price.currency)}</dd>
        </div>
      </dl>

      <p style={{ marginTop: 26 }}>
        <a href={`/tours/${booking.tour.slug}`}>Volver al tour</a> · <a href="/tours">Ver todos los tours</a>
      </p>
    </div>
  );
}
