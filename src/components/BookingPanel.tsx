"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney, SLOT_LABEL } from "@/lib/format";
import { WeatherBadge } from "@/components/WeatherBadge";

type Slot = "MORNING" | "AFTERNOON" | "EVENING";

export type Quote = {
  bookingDate: string;
  timeSlot: Slot;
  passengersCount: number;
  availability: { maxCapacity: number; availableSpots: number };
  weather: {
    status: string;
    rainProbability: number | null;
    source: string;
    observedAt: string;
  };
  price: {
    basePriceCents: number;
    discountBps: number;
    discountCents: number;
    finalPriceCents: number;
    currency: string;
    discountApplied: boolean;
    thresholdPct: number;
  };
  quoteToken: string;
  quoteExpiresAt: string;
};

export function BookingPanel(props: {
  tourId: string;
  slots: Slot[];
  currency: string;
  basePriceCents: number;
  minDate: string;
  maxDate: string;
  maxForecastDate: string;
}) {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<Slot>(props.slots[0]);
  const [passengers, setPassengers] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tourId: props.tourId, bookingDate: date, timeSlot: slot, passengersCount: passengers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "No pudimos cotizar.");
      setQuote(data);
    } catch (e) {
      setQuote(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date, slot, props.tourId]);

  useEffect(() => {
    setNotice(null);
    const t = setTimeout(fetchQuote, 250);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteToken: quote?.quoteToken,
          customerName: name,
          customerEmail: email,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setQuote({ ...(quote as Quote), ...data.quote });
        setNotice("El pronóstico cambió y con él el precio. Revísalo y confirma de nuevo.");
        return;
      }

      if (!res.ok) throw new Error(data?.error?.message ?? "No pudimos iniciar el pago.");

      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const price = quote?.price;
  const outOfForecast = Boolean(date) && date > props.maxForecastDate;
  const ready = Boolean(date && name.trim().length >= 2 && email.includes("@") && quote);

  return (
    <form className="panel" onSubmit={handleCheckout}>
      <h2>Reserva tu fecha</h2>

      <div className="row">
        <div className="field">
          <label htmlFor="date">Fecha</label>
          <input
            id="date"
            type="date"
            value={date}
            min={props.minDate}
            max={props.maxDate}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="slot">Franja</label>
          <select
            id="slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value as Slot)}
          >
            {props.slots.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="passengers">Pasajeros</label>
          <input
            id="passengers"
            type="number"
            min={1}
            max={20}
            value={passengers}
            onChange={(e) => setPassengers(Math.max(1, Math.min(20, Number(e.target.value))))}
          />
        </div>
      </div>

      {quote && !loading && (
        <p className="muted" style={{ fontSize: ".82rem", margin: "4px 0 0" }}>
          {quote.availability.availableSpots} cupo{quote.availability.availableSpots !== 1 ? "s" : ""} disponible{quote.availability.availableSpots !== 1 ? "s" : ""} de {quote.availability.maxCapacity}
        </p>
      )}

      {outOfForecast && (
        <div className="alert warn">
          Esa fecha está más allá de los 14 días de pronóstico. Puedes reservar al precio
          base; el descuento por lluvia no aplica todavía.
        </div>
      )}

      {loading && (
        <div className="alert info">
          <span className="spinner" aria-hidden="true" /> Consultando el pronóstico…
        </div>
      )}

      {quote && !loading && <WeatherBadge quote={quote} />}

      <div className="total">
        {price?.discountApplied && (
          <span className="strike">
            {formatMoney(price.basePriceCents, price.currency)}
          </span>
        )}
        <span className="final">
          {formatMoney(price?.finalPriceCents ?? props.basePriceCents, props.currency)}
        </span>
        {price?.discountApplied && (
          <span className="save">
            Ahorras {formatMoney(price.discountCents, price.currency)} por lluvia prevista
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="name">Nombre completo</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Joel Santos"
          required
          minLength={2}
        />
      </div>

      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          required
        />
      </div>

      {notice && <div className="alert warn">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <button className="cta" type="submit" disabled={!ready || submitting}>
        {submitting ? "Redirigiendo a Stripe…" : "Pagar y reservar"}
      </button>

      <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
        El precio lo calcula nuestro servidor con el pronóstico del destino. El pago se
        procesa en Stripe; nunca vemos tu tarjeta.
      </p>
    </form>
  );
}
