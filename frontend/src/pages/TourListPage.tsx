import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Tour } from "../types";
import { api } from "../lib/api";
import { formatMoney, SLOT_LABEL } from "../lib/format";

export function TourListPage() {
  const [tours,   setTours]   = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    api.tours.list()
      .then((r) => setTours(r.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Cargando tours…</p>;
  if (error)   return <p className="muted">Error: {error}</p>;

  return (
    <>
      <h1>Tours en República Dominicana</h1>
      <p className="muted">
        Elige una fecha dentro de los próximos 14 días. Si la probabilidad de lluvia supera el 60%, el descuento se aplica solo.
      </p>
      <div className="tour-grid">
        {tours.map((tour) => (
          <Link key={tour.id} className="tour-card" to={`/tours/${tour.slug}`}>
            <h3>{tour.title}</h3>
            <p className="loc">{tour.locationName}</p>
            <p className="desc">{tour.description}</p>
            <div className="foot">
              <span className="price">{formatMoney(tour.basePriceCents, tour.currency)}</span>
              <span className="muted" style={{ fontSize: ".82rem" }}>
                {tour.slots.map((s) => SLOT_LABEL[s]).join(" · ")}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
