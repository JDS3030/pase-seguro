import { useCallback, useEffect, useRef, useState } from "react";
import type { Quote, TimeSlot, Tour } from "../types";
import { api } from "../lib/api";
import { formatMoney, SLOT_LABEL } from "../lib/format";
import { WeatherBadge } from "./WeatherBadge";

interface Props {
  tour: Tour;
  minDate: string;
  maxDate: string;
  maxForecastDate: string;
}

export function BookingPanel({ tour, minDate, maxDate, maxForecastDate }: Props) {
  const [date, setDate]             = useState("");
  const [slot, setSlot]             = useState<TimeSlot>(tour.slots[0]);
  const [passengers, setPassengers] = useState(1);
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");

  const [quote, setQuote]           = useState<Quote | null>(null);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [notice, setNotice]         = useState<string | null>(null);

  // Debounce: sólo cotiza cuando el usuario deja de cambiar inputs por 250 ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.bookings.quote({
        tourId: tour.id,
        bookingDate: date,
        timeSlot: slot,
        passengersCount: passengers,
      });
      setQuote(data);
    } catch (e) {
      setQuote(null);
      const err = e as { code?: string; message: string };
      if (err.code === "SOLD_OUT") setError("Esta franja está agotada para esa fecha.");
      else if (err.code === "CAPACITY_EXCEEDED") setError(`Solo quedan ${(e as { details?: { availableSpots?: number } }).details?.availableSpots ?? 0} cupo(s).`);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date, slot, passengers, tour.id]);

  useEffect(() => {
    setQuote(null);
    setNotice(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchQuote, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchQuote]);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const data = await api.bookings.checkout({
        quoteToken: quote.quoteToken,
        customerName: name,
        customerEmail: email,
      });
      window.location.href = data.checkoutUrl;
    } catch (e) {
      const err = e as { code?: string; message: string; status?: number };
      if (err.status === 409 && err.code === "PRICE_CHANGED") {
        setNotice("El pronóstico cambió y con él el precio. Vuelve a consultar.");
        setQuote(null);
      } else if (err.status === 409 && (err.code === "CAPACITY_EXCEEDED" || err.code === "SOLD_OUT")) {
        setError("Ya no quedan cupos para tu selección. Elige otra fecha o franja.");
        setQuote(null);
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const price          = quote?.price;
  const avail          = quote?.availability;
  const outOfForecast  = Boolean(date) && date > maxForecastDate;
  const soldOut        = avail !== undefined && avail.availableSpots < passengers;

  // Clamp passengers cuando los cupos disponibles cambian
  const effectiveMax = avail ? Math.max(1, avail.availableSpots) : tour.maxCapacity;
  useEffect(() => {
    if (avail && passengers > avail.availableSpots && avail.availableSpots > 0) {
      setPassengers(avail.availableSpots);
    }
  }, [avail?.availableSpots]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready          = Boolean(date && name.trim().length >= 2 && email.includes("@") && quote && !soldOut);

  // Precio total = precio unitario × pasajeros
  const unitFinal      = price?.finalPriceCents ?? tour.basePriceCents;
  const unitBase       = price?.basePriceCents  ?? tour.basePriceCents;
  const totalFinal     = unitFinal * passengers;
  const totalBase      = unitBase  * passengers;
  const currency       = price?.currency ?? tour.currency;

  return (
    <form className="panel" onSubmit={handleCheckout}>
      <h2>Reserva tu fecha</h2>

      <div className="row">
        <div className="field">
          <label htmlFor="date">Fecha</label>
          <input id="date" type="date" value={date} min={minDate} max={maxDate}
            onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="slot">Franja</label>
          <select id="slot" value={slot} onChange={(e) => setSlot(e.target.value as TimeSlot)}>
            {tour.slots.map((s) => (
              <option key={s} value={s}>{SLOT_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="passengers">Pasajeros</label>
          <input id="passengers" type="number" min={1} max={effectiveMax} value={passengers}
            onChange={(e) => setPassengers(Math.max(1, Math.min(effectiveMax, Number(e.target.value))))}
            disabled={avail !== undefined && avail.availableSpots === 0} />
        </div>
      </div>

      {/* Indicador de cupos */}
      {avail && !loading && (
        <p className={`muted ${soldOut ? "danger" : ""}`} style={{ fontSize: ".82rem", margin: "4px 0 0" }}>
          {soldOut
            ? `Sin cupos suficientes (${avail.availableSpots} disponible${avail.availableSpots !== 1 ? "s" : ""})`
            : `${avail.availableSpots} de ${avail.maxCapacity} cupo${avail.availableSpots !== 1 ? "s" : ""} disponible${avail.availableSpots !== 1 ? "s" : ""}`}
        </p>
      )}

      {outOfForecast && (
        <div className="alert warn">
          Fecha fuera del pronóstico de 14 días. Puedes reservar al precio base; el descuento por lluvia no aplica aún.
        </div>
      )}

      {loading && (
        <div className="alert info">
          <span className="spinner" aria-hidden="true" /> Consultando pronóstico y cupos…
        </div>
      )}

      {quote && !loading && <WeatherBadge quote={quote} />}

      {/* Precios: tachado si hay descuento, total × pasajeros */}
      <div className="total">
        {price?.discountApplied && (
          <span className="strike">{formatMoney(totalBase, currency)}</span>
        )}
        <span className="final">{formatMoney(totalFinal, currency)}</span>
        {price?.discountApplied && (
          <span className="save">
            Ahorras {formatMoney((unitBase - unitFinal) * passengers, currency)} por lluvia prevista
          </span>
        )}
        {passengers > 1 && (
          <span className="muted" style={{ fontSize: ".8rem" }}>
            ({formatMoney(unitFinal, currency)} × {passengers} personas)
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="name">Nombre completo</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Joel Santos" required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com" required />
      </div>

      {notice && <div className="alert warn">{notice}</div>}
      {error  && <div className="alert error">{error}</div>}

      <button className="cta" type="submit" disabled={!ready || submitting || soldOut}>
        {soldOut ? "Sin cupos disponibles" : submitting ? "Redirigiendo a Stripe…" : "Pagar y reservar"}
      </button>

      <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
        El precio lo calcula el servidor. Pago procesado por Stripe; nunca vemos tu tarjeta.
      </p>
    </form>
  );
}
