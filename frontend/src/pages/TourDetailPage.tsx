import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Tour } from "../types";
import { api } from "../lib/api";
import { formatMoney, SLOT_LABEL, SLOT_RANGE } from "../lib/format";
import { BookingPanel } from "../components/BookingPanel";

type TourWithWindow = Tour & {
  forecastWindow: { minDate: string; maxDate: string; maxForecastDate: string };
};

export function TourDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tour,    setTour]    = useState<TourWithWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api.tours.get(slug)
      .then((data) => setTour(data as TourWithWindow))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="muted">Cargando tour…</p>;
  if (error || !tour) return (
    <div>
      <p className="muted">{error ?? "Tour no encontrado."}</p>
      <Link to="/tours">← Volver al catálogo</Link>
    </div>
  );

  const { forecastWindow: win } = tour;

  return (
    <div className="detail">
      <div className="body">
        <Link className="crumb" to="/tours">← Todos los tours</Link>
        <h1>{tour.title}</h1>
        <p className="muted">{tour.locationName}</p>
        <p>{tour.description}</p>

        <dl className="facts">
          <div>
            <dt>Duración</dt>
            <dd>{tour.durationMin >= 1440
              ? `${Math.round(tour.durationMin / 1440)} días`
              : `${Math.round(tour.durationMin / 60)} horas`}</dd>
          </div>
          <div><dt>Franjas</dt><dd>{tour.slots.map((s) => SLOT_LABEL[s]).join(" · ")}</dd></div>
          <div><dt>Horario</dt><dd>{tour.slots.map((s) => SLOT_RANGE[s]).join(" / ")}</dd></div>
          <div><dt>Precio base por persona</dt><dd>{formatMoney(tour.basePriceCents, tour.currency)}</dd></div>
          <div><dt>Cupo máximo</dt><dd>{tour.maxCapacity} personas por franja</dd></div>
        </dl>
      </div>

      <BookingPanel
        tour={tour}
        minDate={win.minDate}
        maxDate={win.maxDate}
        maxForecastDate={win.maxForecastDate}
      />
    </div>
  );
}
